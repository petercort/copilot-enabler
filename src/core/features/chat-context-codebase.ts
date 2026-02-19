import { defineFeature } from './definition';

export const contextCodebase = defineFeature({
  id: 'context-codebase',
  name: '#codebase Variable',
  category: 'Chat',
  description:
    'Let Copilot search your entire codebase to find relevant context for your question.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
  detectHints: ['#codebase'],
  tags: ['advanced'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Type #codebase in the chat panel — Copilot will search the full project for relevant code.',
  ],
  tutorialPrompt: `I'd like to learn how to use the #codebase variable in GitHub Copilot Chat to leverage my entire project.

Please help me understand this feature by:
1. What #codebase does and why it's powerful:
   - How Copilot searches your entire project for relevant code
   - When broad codebase context is better than specific files
   - How this helps you understand patterns across your project
2. Common use cases for #codebase:
   - Understanding how a specific pattern is used across your codebase
   - Finding all implementations of an interface or abstract class
   - Learning your project's error handling patterns
   - Discovering where a particular utility function is used
   - Adapting external code to match your project's conventions
3. How to use #codebase effectively:
   - Writing questions that leverage full-project context
   - Asking Copilot to find and explain patterns
   - Using #codebase to ensure consistency across files
4. Combining #codebase with other context:
   - #codebase + #file for file-specific questions with project context
   - #codebase + #selection for precise questions about patterns
5. Understanding what Copilot finds:
   - How search works across your files
   - Interpreting the relevant code samples it shows

Demonstrate with actual patterns and conventions from my codebase.`,
});
