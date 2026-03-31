import { defineFeature } from '../definition';

export const coreChatPanel = defineFeature({
  id: 'core-chat-panel',
  name: 'Chat Panel',
  category: 'Core',
  description:
    'Dedicated sidebar panel for extended conversations with Copilot.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat',
  detectHints: ['chat panel', 'copilot.chat', 'chat-panel', 'copilot chat', 'ccreq', 'chat request', 'messagesapi'],
  impact: 'high',
  difficulty: 'low',
  setupSteps: [
    'Press Ctrl+Shift+I (Cmd+Shift+I on Mac) or click the Copilot icon in the sidebar.',
  ],
});
