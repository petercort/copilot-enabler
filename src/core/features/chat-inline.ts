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
});
