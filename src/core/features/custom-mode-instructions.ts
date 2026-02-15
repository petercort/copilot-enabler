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
  tutorialPrompt: `I'd like to learn about Per-Mode Custom Instructions and how I can tailor Copilot's behavior for different workflows.

Please help me understand this feature by:
1. First, examining my workspace to understand my coding patterns and project type
2. Explaining the three Copilot modes (Ask, Edit, and Agent) and how they differ in practice
3. Asking me about how I use each mode differently, such as:
   - What I typically ask in Ask mode (questions, explanations, debugging)
   - What I typically do in Edit mode (refactoring, implementing features)
   - What I typically do in Agent mode (complex multi-step tasks)
4. Based on my responses, suggest specific custom instructions for each mode that would improve my workflow:
   - For Ask mode: What context or constraints would make explanations better?
   - For Edit mode: What coding standards or patterns should be enforced?
   - For Agent mode: What tools or guardrails would make it more effective?
5. Show me concrete examples of instructions for each mode, specific to my project:
   - Example ask.instructions.md content
   - Example edit.instructions.md content
   - Example agent.instructions.md content
6. Explain how these different instructions would change Copilot's behavior in each mode

Please tailor this to my actual project and development style - make the examples realistic for what I'm building.`,
});
