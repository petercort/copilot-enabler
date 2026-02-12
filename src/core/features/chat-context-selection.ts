import { defineFeature } from './definition';

export const contextSelection = defineFeature({
  id: 'context-selection',
  name: '#selection Variable',
  category: 'Chat',
  description:
    'Reference the currently selected code in chat for focused assistance.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
  detectHints: ['#selection'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Select code in the editor, then type #selection in chat to reference it.',
  ],
});
