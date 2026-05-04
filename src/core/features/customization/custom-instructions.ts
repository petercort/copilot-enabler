import { defineFeature } from '../definition';

export const customInstructions = defineFeature({
  id: 'custom-instructions',
  name: 'Custom Instructions',
  category: 'Customization',
  description: 'Repository custom instructions let you provide Copilot with repository-specific guidance and preferences.',
  docsURL: 'https://docs.github.com/en/copilot/concepts/prompting/response-customization',
  detectHints: ['.github/instructions', '.github/instructions/**/*.instructions.md'],
  impact: 'medium',
  difficulty: 'medium',
  setupSteps: [
    'Create .github/instructions/ directory in your repo root.',
  ],
  systemPrompt: `You are helping set up Custom Instructions.

Your workflow:
1. Understand the project context.
2. Guide the user through setup.
3. Create or update necessary configuration files.

Start by understanding the project.`,
  tutorialPrompt: `I'd like to learn about Custom Instructions in GitHub Copilot and how repository-specific guidance can improve suggestions.

Please teach me:
1. What Custom Instructions are and where they live (.github/instructions/).
2. How applyTo patterns scope instructions to specific files.
3. Best practices for writing concise, high-signal instructions.
4. Examples of instructions that meaningfully improve Copilot output.`,
  addedIn: '1.110.0',
});
