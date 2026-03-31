import { defineFeature } from '../definition';

export const toolsChanges = defineFeature({
  id: 'tools-changes',
  name: '#Changes',
  category: 'Tools',
  description: 'Get diffs of changed files',
  docsURL: 'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
  detectHints: ['#changes', 'get_changed_files'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Type #changes in the chat panel to get a summary of changes in your local branch',
  ],
  tutorialPrompt: `Summarize changes in my local branch compared to the remote origin.`,
});
