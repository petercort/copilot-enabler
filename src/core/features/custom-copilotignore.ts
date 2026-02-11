import { defineFeature } from './definition';

export const customCopilotignore = defineFeature({
  id: 'custom-copilotignore',
  name: '.copilotignore File',
  category: 'Customization',
  description:
    "Exclude specific files or directories from Copilot's context and suggestions.",
  docsURL:
    'https://code.visualstudio.com/docs/copilot/copilot-customization',
  detectHints: ['.copilotignore'],
  tags: ['advanced', 'enterprise'],
  impact: 'medium',
  difficulty: 'medium',
  setupSteps: [
    'Create a .copilotignore file in your repo root.',
    'Use .gitignore syntax to list files/patterns to exclude.',
  ],
  systemPrompt: `You are helping create a .copilotignore file to exclude files from Copilot's context.

Your workflow:
1. Use list_directory with path "." to see the project structure.
2. Check if .gitignore exists by trying read_file.
3. Identify files to exclude (build outputs, vendor, generated files, secrets).
4. Show the user what you plan to exclude and ask for adjustments.
5. Use write_file to create .copilotignore.

Start immediately by reading the project structure.`,
});
