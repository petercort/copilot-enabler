import { defineFeature } from '../definition';

export const toolsSelection = defineFeature({
  id: 'tools-terminal-selection',
  name: '#terminalSelection Variable',
  category: 'Tools',
  description:
    'Reference the currently selected code in chat for focused assistance.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
  detectHints: ['#terminalSelection', 'terminal_selection'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Select code in the editor, then type #terminalSelection in chat to reference it.',
  ],
  tutorialPrompt: `I'd like to learn how to use the #terminalSelection variable in GitHub Copilot Chat for precise code assistance.

Please help me understand this feature by:
1. Explaining what #terminalSelection does:
   - How selecting code and using #terminalSelection passes that code to Copilot
   - Why focused context produces better suggestions than broader context
   - When #terminalSelection is better than #file or #codebase
2. Common workflows with #terminalSelection:
   - Getting explanations for specific code snippets
   - Asking for refactoring suggestions on a particular function
   - Requesting optimizations for selected algorithms
   - Getting help understanding complex logic you didn't write
3. Best practices:
   - How much code to select for the best results
   - Combining #terminalSelection with clear questions
   - Using #terminalSelection to isolate problems
4. Practical examples from my codebase:
   - Complex functions that might benefit from explanation
   - Code patterns I'd like to improve
5. How #terminalSelection compares to other context variables

Walk me through real scenarios using actual code from my project.`,
});
