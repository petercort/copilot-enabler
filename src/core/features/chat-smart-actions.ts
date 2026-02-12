import { defineFeature } from './definition';

export const smartActions = defineFeature({
  id: 'smart-actions',
  name: 'Smart Actions',
  category: 'Chat',
  description:
    'Predefined AI-powered actions for common tasks: generating commit messages, renaming symbols, fixing errors, and running semantic search across your project.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/copilot-smart-actions',
  detectHints: ['smart action', 'generate commit message', 'copilot fix', 'copilot rename'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Right-click on code in the editor and look for Copilot actions in the context menu.',
    'Use the lightbulb (Quick Fix) menu to see AI-powered fix suggestions.',
    'In the Source Control view, click the sparkle icon to generate a commit message.',
  ],
});
