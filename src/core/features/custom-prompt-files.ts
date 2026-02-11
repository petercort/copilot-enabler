import { defineFeature } from './definition';

export const customPromptFiles = defineFeature({
  id: 'custom-prompt-files',
  name: 'Reusable Prompt Files',
  category: 'Customization',
  description:
    'Create .prompt.md files to define reusable, shareable prompt templates for common tasks.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/copilot-customization#_reusable-prompts',
  detectHints: ['.prompt.md'],
  tags: ['advanced', 'new'],
  impact: 'high',
  difficulty: 'medium',
  setupSteps: [
    'Create a .github/prompts/ directory in your repo.',
    'Add .prompt.md files with front-matter (mode, tools) and prompt body.',
    'Reference them from chat with / commands.',
  ],
  systemPrompt: `You are helping create reusable .prompt.md files for Copilot workflows.

Your workflow:
1. Use list_directory and read_file to understand the project.
2. Ask what common tasks they want prompt templates for (code review, docs, testing, refactoring).
3. For each prompt, generate a .prompt.md with YAML front-matter (mode, tools) and prompt body.
4. Use write_file to create each file in .github/prompts/

Example front-matter:
---
mode: agent
tools: ["read_file", "write_file"]
---

Start by understanding the project, then ask what prompts they want.`,
});
