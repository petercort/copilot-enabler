import { defineFeature } from './definition';

export const chatInline = defineFeature({
  id: 'chat-inline',
  name: 'Inline Chat',
  category: 'Chat',
  description:
    'Trigger Copilot chat directly in the editor at your cursor position for contextual help.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_inline-chat',
  detectHints: ['inline chat', 'inlineChat'],
  tags: ['core'],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    'Place your cursor in the editor and press Ctrl+I (Cmd+I on Mac).',
  ],
  tutorialPrompt: `I'd like to learn how to use Inline Chat in GitHub Copilot for faster, context-aware assistance.

Please help me understand this feature by:
1. How Inline Chat differs from the main chat panel:
   - Why it's faster for quick questions
   - How it maintains context at your cursor position
   - When to use inline chat vs. the main panel
2. The keyboard shortcut and basic usage:
   - Cmd+I (Mac) or Ctrl+I (Windows/Linux)
   - How to phrase requests for inline responses
   - Accepting, modifying, or discarding suggestions
3. Common inline chat workflows:
   - Explaining code at your cursor
   - Generating documentation for a function
   - Getting refactoring suggestions for selection
   - Fixing a problematic line or block
4. Tips for effective inline chat:
   - Writing clear, concise questions
   - Using selection to limit scope
   - Chaining requests for iterative improvement
5. Practical examples from my coding:
   - Functions that might need documentation
   - Code patterns I frequently refactor

Walk me through actual use cases from my open files.`,
});
