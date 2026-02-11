import { defineFeature } from './definition';

export const chatQuick = defineFeature({
  id: 'chat-quick',
  name: 'Quick Chat',
  category: 'Chat',
  description:
    'Lightweight floating chat window for fast one-off questions.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_quick-chat',
  detectHints: ['quick chat', 'quickChat'],
  tags: ['core'],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    'Press Ctrl+Shift+Alt+L (Cmd+Shift+Alt+L on Mac) to open Quick Chat.',
  ],
});
