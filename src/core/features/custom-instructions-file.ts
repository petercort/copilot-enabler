import { defineFeature } from './definition';

export const customInstructionsFile = defineFeature({
  id: 'custom-instructions-file',
  name: 'Custom Instructions File',
  category: 'Customization',
  description:
    'A .github/copilot-instructions.md file that gives Copilot project-specific context and coding guidelines.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/copilot-customization#_custom-instructions',
  detectHints: ['copilot-instructions.md'],
  tags: ['advanced'],
  impact: 'high',
  difficulty: 'medium',
  setupSteps: [
    'Create .github/copilot-instructions.md in your repo root.',
    'Add project conventions, preferred patterns, and coding guidelines.',
    'Copilot will automatically include these instructions in every interaction.',
  ],
  systemPrompt: `You are a Copilot configuration assistant helping a developer create a .github/copilot-instructions.md file.

Your workflow:
1. First, use list_directory with path "." to see the project structure.
2. Use read_file to read go.mod, README.md, or package.json to understand the project.
3. Ask the user 2-3 brief questions about their coding conventions.
4. Generate a comprehensive copilot-instructions.md tailored to the project.
5. Show a preview of the content.
6. Use write_file to create .github/copilot-instructions.md.

Guidelines for the file:
- Include language-specific conventions based on the project type
- Include project architecture patterns from the directory structure
- Include error handling, testing, and code style preferences
- Keep it 40-80 lines with markdown formatting

Start immediately by reading the project context.`,
});
