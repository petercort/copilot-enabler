import { defineFeature } from './definition';

export const webSearch = defineFeature({
  id: 'web-search',
  name: 'Web Search',
  category: 'Chat',
  description: 'Fetch information from the web',
  docsURL: 'https://code.visualstudio.com/docs/copilot/reference/copilot-vscode-features#_chat-tools',
  detectHints: ['fetch'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'type #fetch in the chat panel and type a URL',
  ],
});
