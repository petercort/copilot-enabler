import { defineFeature } from './definition';

export const contextFile = defineFeature({
  id: 'context-file',
  name: '#file Variable',
  category: 'Chat',
  description:
    'Reference a specific file in chat to give Copilot targeted context.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
  detectHints: ['#file'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Type #file: in the chat panel and select a file from the picker.',
  ],
  tutorialPrompt: `I'd like to learn about the #file variable in GitHub Copilot Chat and how to use it effectively.

Please help me understand this feature by:
1. Explaining what the #file variable does and why it's useful for getting better Copilot suggestions
2. Showing me concrete examples of when I should use #file in chat:
   - Asking for help reviewing a specific file
   - Getting explanations of complex code in a particular file
   - Getting suggestions for improvements to a specific file
3. Demonstrating how to use #file by having me try it with one of my actual project files
4. Showing me how #file compares to other context variables like #selection or #codebase
5. Tips for getting the most relevant responses by combining #file with specific, focused questions

Make this practical and show real examples from my workspace.`,
});
