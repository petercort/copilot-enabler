import { defineFeature } from '../definition';

export const coreQuick = defineFeature({
  id: 'core-quick',
  name: 'Quick Chat',
   category: 'Core',
  description:
    'Lightweight floating chat window for fast one-off questions.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_quick-chat',
  detectHints: [],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    'Press Ctrl+Shift+Alt+L (Cmd+Shift+Alt+L on Mac) to open Quick Chat.',
  ],
  tutorialPrompt: `I'd like to learn how to use Quick Chat in GitHub Copilot for rapid, lightweight conversations.

Please help me understand this feature by:
1. What Quick Chat is and why you'd use it:
   - How it differs from the main chat panel
   - Why it's lighter weight for simple questions
   - When to use Quick Chat vs. full chat panel
2. How to open and use Quick Chat:
   - Keyboard shortcut: Cmd+Shift+Alt+L (Mac) or Ctrl+Shift+Alt+L (Windows/Linux)
   - Basic interaction flow
   - How to close and return to focus on code
3. Best practices for Quick Chat:
   - Asking simple, focused question
   - One-off questions without deep context
   - Quick definitions or explanations
   - Rapid back-and-forth for simple clarifications
4. Workflow integration:
   - When Quick Chat saves time over main chat
   - How it keeps you in code-focused mode
   - Quick answers without context switching
5. Practical quick chat examples:
   - Asking about syntax
   - Requesting quick explanations
   - Simple clarification questions

Walk me through my actual workflow and where Quick Chat fits in.`,
});
