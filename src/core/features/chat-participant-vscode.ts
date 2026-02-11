import { defineFeature } from './definition';

export const chatParticipantVscode = defineFeature({
  id: 'chat-participant-vscode',
  name: '@vscode Participant',
  category: 'Chat',
  description:
    'Chat participant for VS Code settings, keybindings, and editor configuration questions.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-participants',
  detectHints: ['@vscode'],
  tags: ['core'],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    'Type @vscode in the chat panel to ask about editor configuration.',
  ],
});
