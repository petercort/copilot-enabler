import { defineFeature } from '../definition';

export const toolsVscode = defineFeature({
  id: 'tools-vscode',
  name: '@vscode Participant',
  category: 'Tools',
  description:
    'Chat participant for VS Code settings, keybindings, and editor configuration questions.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-participants',
  detectHints: ['@vscode'],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    'Type @vscode in the chat panel to ask about editor configuration.',
  ],
});
