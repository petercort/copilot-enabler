#!/usr/bin/env node
/**
 * Interactive generator for creating new Copilot features.
 * Usage: npm run new-feature
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * Gathers multiple values one at a time.
 * After each entry, asks "Add another?" until the user is done.
 * @param {string} entryPrompt - The prompt shown for each new entry.
 * @param {string} firstEntryPrompt - The prompt shown for the very first entry (optional).
 * @returns {Promise<string[]>} - The collected entries.
 */
async function gatherMultiple(entryPrompt, firstEntryPrompt) {
  const items = [];
  const first = await question(firstEntryPrompt || entryPrompt);
  if (first.trim()) {
    items.push(first.trim());
  }
  while (true) {
    const another = await question('Add another? (y/n): ');
    if (another.toLowerCase() !== 'y') break;
    const item = await question(entryPrompt);
    if (item.trim()) {
      items.push(item.trim());
    }
  }
  return items;
}

/**
 * Auto-generates a system prompt for interactive Copilot implementation sessions
 * based on the feature's metadata.
 * @param {string} name - Feature display name.
 * @param {string} description - Feature description.
 * @param {string} docsURL - Documentation URL.
 * @param {string[]} setupSteps - The setup steps for this feature.
 * @returns {string} - Generated system prompt.
 */
function generateSystemPrompt(name, description, docsURL, setupSteps) {
  const stepsText = setupSteps.length > 0
    ? setupSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : '1. Follow the documentation link below for setup instructions.';
  return `You are helping a developer set up ${name}.

${description}

Your workflow:
1. Use list_directory and read_file to understand the project structure and current configuration.
2. Explain what ${name} does and how it will benefit the developer's workflow.
3. Walk through the setup steps:
${stepsText}
4. Verify the setup is correct and offer to make any adjustments.

Reference documentation: ${docsURL}

Start by understanding the project context, then guide the user through setup.`;
}

const categories = ['Core', 'Tools', 'Customization'];
const categoryDirs = { Core: 'core', Tools: 'tools', Customization: 'customization' };
const impacts = ['low', 'medium', 'high'];
const difficulties = ['low', 'medium', 'high'];

async function main() {
  console.log('\n🚀 Creating a new Copilot feature...\n');

  // Gather feature details
  const id = await question('Feature ID (kebab-case, e.g., chat-inline): ');
  const name = await question('Feature Name (e.g., Inline Chat): ');
  
  console.log('\nSelect category:');
  categories.forEach((cat, i) => console.log(`  ${i + 1}. ${cat}`));
  const categoryIndex = parseInt(await question('Category (1-3): ')) - 1;
  const category = categories[categoryIndex] || 'Core';

  const description = await question('Brief description: ');
  const docsURL = await question('Documentation URL: ');

  console.log('\nEnter detect hints one at a time (e.g., setting name or keyword):');
  const detectHints = await gatherMultiple(
    'Next detect hint: ',
    'First detect hint: ',
  );
  
  console.log('\nSelect impact:');
  impacts.forEach((imp, i) => console.log(`  ${i + 1}. ${imp}`));
  const impactIndex = parseInt(await question('Impact (1-3): ')) - 1;
  const impact = impacts[impactIndex] || 'medium';

  console.log('\nSelect difficulty:');
  difficulties.forEach((diff, i) => console.log(`  ${i + 1}. ${diff}`));
  const difficultyIndex = parseInt(await question('Difficulty (1-3): ')) - 1;
  const difficulty = difficulties[difficultyIndex] || 'low';

  console.log('\nEnter setup steps one at a time:');
  const setupSteps = await gatherMultiple(
    'Next setup step: ',
    'First setup step: ',
  );

  // Prompt for addedIn version with validation
  let addedIn = '';
  const versionPattern = /^\d+\.\d+\.\d+$/;
  while (!versionPattern.test(addedIn)) {
    addedIn = await question('Added in version (e.g., 1.110.0) [default: 1.110.0]: ');
    if (addedIn.trim() === '') { addedIn = '1.110.0'; }
    if (!versionPattern.test(addedIn)) {
      console.log('  ⚠  Version must match MAJOR.MINOR.PATCH (e.g., 1.111.0). Please try again.');
    }
  }

  rl.close();

  // Determine subdirectory and file path
  const categoryDir = categoryDirs[category] || 'core';
  const filename = `${categoryDir}-${id}.ts`;
  const featureDir = path.join(__dirname, '..', 'src', 'core', 'features', categoryDir);
  if (!fs.existsSync(featureDir)) {
    fs.mkdirSync(featureDir, { recursive: true });
  }
  const filepath = path.join(featureDir, filename);

  // Auto-generate system prompt from feature metadata
  const systemPrompt = generateSystemPrompt(name, description, docsURL, setupSteps);

  const detectHintsArray = detectHints.length > 0
    ? detectHints.map((h) => `'${h}'`).join(',\n    ')
    : `'${id}'`;
  const setupStepsArray = setupSteps.length > 0
    ? setupSteps.map((s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(',\n    ')
    : `'Set up ${name}.'`;

  const content = `import { defineFeature } from '../definition';

export const ${toCamelCase(id)} = defineFeature({
  id: '${id}',
  name: '${name}',
  category: '${category}',
  description: '${description}',
  docsURL: '${docsURL}',
  detectHints: [
    ${detectHintsArray},
  ],
  impact: '${impact}',
  difficulty: '${difficulty}',
  setupSteps: [
    ${setupStepsArray},
  ],
  addedIn: '${addedIn}',
  systemPrompt: \`${systemPrompt.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`,
});
`;

  // Write feature file
  fs.writeFileSync(filepath, content);
  console.log(`\n✅ Created ${filepath}`);

  // Update registry
  const registryPath = path.join(__dirname, '..', 'src', 'core', 'features', 'registry.ts');
  let registryContent = fs.readFileSync(registryPath, 'utf8');

  // Add import before the END IMPORTS sentinel
  const importMarker = '// ── END IMPORTS ──';
  const importStatement = `import { ${toCamelCase(id)} } from './${categoryDir}/${filename.replace('.ts', '')}';\n`;
  if (!registryContent.includes(importMarker)) {
    console.error('❌ Could not find "// ── END IMPORTS ──" marker in registry.ts');
    process.exit(1);
  }
  registryContent = registryContent.replace(importMarker, importStatement + importMarker);

  // Add to array before the END DEFINITIONS sentinel
  const defMarker = '// ── END DEFINITIONS ──';
  const featureEntry = `${toCamelCase(id)},\n  `;
  if (!registryContent.includes(defMarker)) {
    console.error('❌ Could not find "// ── END DEFINITIONS ──" marker in registry.ts');
    process.exit(1);
  }
  registryContent = registryContent.replace(defMarker, featureEntry + defMarker);

  fs.writeFileSync(registryPath, registryContent);
  console.log(`✅ Updated registry.ts`);

  console.log('\n📝 Next steps:');
  console.log('  1. Review and edit the generated file if needed');
  console.log('  2. Run `npm test` to verify');
  console.log('  3. Commit your changes\n');
}

function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

main().catch(console.error);
