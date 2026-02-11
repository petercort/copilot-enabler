import { defineFeature } from './definition';

export const contextProblems = defineFeature({
  id: 'context-problems',
  name: '#problems Variable',
  category: 'Context',
  description:
    'Reference current errors and warnings from the Problems panel in chat.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
  detectHints: ['#problems'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Type #problems in chat to include current workspace diagnostics in the conversation.',
  ],
});
