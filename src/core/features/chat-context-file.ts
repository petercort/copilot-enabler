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
});
