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

const categories = ['Modes', 'Chat', 'Completion', 'Customization', 'Context'];
const impacts = ['low', 'medium', 'high'];
const difficulties = ['low', 'medium', 'high'];

async function main() {
  console.log('\n🚀 Creating a new Copilot feature...\n');

  // Gather feature details
  const id = await question('Feature ID (kebab-case, e.g., chat-inline): ');
  const name = await question('Feature Name (e.g., Inline Chat): ');
  
  console.log('\nSelect category:');
  categories.forEach((cat, i) => console.log(`  ${i + 1}. ${cat}`));
  const categoryIndex = parseInt(await question('Category (1-5): ')) - 1;
  const category = categories[categoryIndex] || 'Chat';

  const description = await question('Brief description: ');
  const docsURL = await question('Documentation URL: ');
  const detectHint = await question('Primary detect hint (e.g., setting name or keyword): ');
  
  console.log('\nSelect impact:');
  impacts.forEach((imp, i) => console.log(`  ${i + 1}. ${imp}`));
  const impactIndex = parseInt(await question('Impact (1-3): ')) - 1;
  const impact = impacts[impactIndex] || 'medium';

  console.log('\nSelect difficulty:');
  difficulties.forEach((diff, i) => console.log(`  ${i + 1}. ${diff}`));
  const difficultyIndex = parseInt(await question('Difficulty (1-3): ')) - 1;
  const difficulty = difficulties[difficultyIndex] || 'low';

  const setupStep = await question('First setup step: ');
  const includePrompt = await question('Include system prompt for implementation? (y/n): ');

  rl.close();

  // Generate filename
  const filename = `${id}.ts`;
  const filepath = path.join(__dirname, '..', 'src', 'core', 'features', filename);

  // Generate feature definition
  const systemPromptSection = includePrompt.toLowerCase() === 'y' 
    ? `\n  systemPrompt: \`You are helping set up ${name}.

Your workflow:
1. Understand the project context.
2. Guide the user through setup.
3. Create or update necessary configuration files.

Start by understanding the project.\`,`
    : '';

  const content = `import { defineFeature } from './definition';

export const ${toCamelCase(id)} = defineFeature({
  id: '${id}',
  name: '${name}',
  category: '${category}',
  description: '${description}',
  docsURL: '${docsURL}',
  detectHints: ['${detectHint}'],
  tags: ['core'],
  impact: '${impact}',
  difficulty: '${difficulty}',
  setupSteps: [
    '${setupStep}',
  ],${systemPromptSection}
});
`;

  // Write feature file
  fs.writeFileSync(filepath, content);
  console.log(`\n✅ Created ${filepath}`);

  // Update registry
  const registryPath = path.join(__dirname, '..', 'src', 'core', 'features', 'registry.ts');
  let registryContent = fs.readFileSync(registryPath, 'utf8');

  // Add import
  const importStatement = `import { ${toCamelCase(id)} } from './${id}';\n`;
  const importInsertPos = registryContent.indexOf('export const allFeatureDefinitions');
  registryContent = registryContent.slice(0, importInsertPos) + importStatement + registryContent.slice(importInsertPos);

  // Add to array
  const arrayInsertPos = registryContent.indexOf('// Features will be added here as they are migrated');
  const featureEntry = `  ${toCamelCase(id)},\n  `;
  registryContent = registryContent.slice(0, arrayInsertPos) + featureEntry + registryContent.slice(arrayInsertPos);

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
