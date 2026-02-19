import { defineFeature } from './definition';

export const contextSelection = defineFeature({
  id: 'context-selection',
  name: '#selection Variable',
  category: 'Chat',
  description:
    'Reference the currently selected code in chat for focused assistance.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
  detectHints: ['#selection'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Select code in the editor, then type #selection in chat to reference it.',
  ],
  tutorialPrompt: `I'd like to learn how to use the #selection variable in GitHub Copilot Chat for precise code assistance.

Please help me understand this feature by:
1. Explaining what #selection does:
   - How selecting code and using #selection passes that code to Copilot
   - Why focused context produces better suggestions than broader context
   - When #selection is better than #file or #codebase
2. Common workflows with #selection:
   - Getting explanations for specific code snippets
   - Asking for refactoring suggestions on a particular function
   - Requesting optimizations for selected algorithms
   - Getting help understanding complex logic you didn't write
3. Best practices:
   - How much code to select for the best results
   - Combining #selection with clear questions
   - Using #selection to isolate problems
4. Practical examples from my codebase:
   - Complex functions that might benefit from explanation
   - Code patterns I'd like to improve
5. How #selection compares to other context variables

Walk me through real scenarios using actual code from my project.`,
});
