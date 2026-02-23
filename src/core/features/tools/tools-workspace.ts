import { defineFeature } from '../definition';

export const toolsWorkspace = defineFeature({
  id: 'tools-workspace',
  name: '@workspace Participant',
  category: 'Tools',
  description:
    "Chat participant that scopes Copilot's context to your entire workspace for project-wide questions.",
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-participants',
  detectHints: ['@workspace', 'panel/workspace'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Type @workspace in the chat panel followed by your question.',
  ],
});
