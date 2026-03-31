import { defineFeature } from '../definition';

export const toolsTerminal = defineFeature({
  id: 'tools-terminal',
  name: '@terminal',
  category: 'Tools',
  description:
    'Chat participant specialized for terminal and shell command assistance.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-participants',
  detectHints: ['@terminal', 'panel/terminal'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Type @terminal in the chat panel to get help with shell commands.',
  ],
});
