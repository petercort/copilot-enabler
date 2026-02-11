import { defineFeature } from './definition';

export const contextCodebase = defineFeature({
  id: 'context-codebase',
  name: '#codebase Variable',
  category: 'Context',
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
});
