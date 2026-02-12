import { defineFeature } from './definition';

export const customModeInstructions = defineFeature({
  id: 'custom-mode-instructions',
  name: 'Per-Mode Custom Instructions',
  category: 'Customization',
  description:
    'Provide separate custom instructions for Ask, Edit, and Agent modes to tailor behavior per workflow.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/copilot-customization#_custom-instructions',
  detectHints: ['modeinstructions', 'mode instructions', 'github.copilot.chat.modeinstructions', 'github.copilot-chat.modeinstructions'],
  tags: ['advanced', 'new'],
  impact: 'medium',
  difficulty: 'medium',
  setupSteps: [
    'In VS Code settings, configure github.copilot.chat.modeInstructions for each mode.',
    'Or create mode-specific instruction files in .github/instructions/.',
  ],
  systemPrompt: `You are helping set up per-mode custom instructions for Ask, Edit, and Agent modes.

Your workflow:
1. Read project context using list_directory and read_file.
2. Ask how they want each mode to behave differently.
3. Create instruction files in .github/instructions/ (ask.instructions.md, edit.instructions.md, agent.instructions.md).
4. Use write_file to create each file.

Start by understanding the project.`,
});
