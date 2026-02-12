import { defineFeature } from './definition';

export const chatParticipantTerminal = defineFeature({
  id: 'chat-participant-terminal',
  name: '@terminal Participant',
  category: 'Agents',
  description:
    'Chat participant specialized for terminal and shell command assistance.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-participants',
  detectHints: ['@terminal'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Type @terminal in the chat panel to get help with shell commands.',
  ],
});
