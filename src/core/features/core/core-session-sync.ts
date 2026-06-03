import { defineFeature } from '../definition';

export const coreSessionSync = defineFeature({
  id: 'core-session-sync',
  name: 'Session Sync',
  category: 'Core',
  description:
    'Automatically backs up and syncs your Copilot chat sessions to your GitHub account so you can search and revisit past work across machines. Stores files touched, chat content, repository context, branches, and linked PRs and issues.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/chat/chat-sessions',
  detectHints: ['chat.sessionSync.enabled', 'session sync', 'session history'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Enable `chat.sessionSync.enabled` in your VS Code settings.',
    'Sign in with your GitHub account if prompted — sessions are stored linked to your account.',
    'Use the Copilot status dashboard in the VS Code Status Bar to manage and search your session history.',
    'Ask natural-language questions about past sessions, e.g. "What did I work on last Friday?"',
  ],
  tutorialPrompt: `I'd like to learn about Session Sync in VS Code Copilot.

Please help me understand this feature by:
1. What Session Sync is:
   - How it automatically backs up chat sessions to your GitHub account
   - What is stored per session (chat content, files touched, repo context, branches, PRs, issues)
   - How it differs from the local Chronicle index (which stores data only on the current machine)
2. How to enable it:
   - Enabling \`chat.sessionSync.enabled\`
   - How GitHub account authentication ties sessions to your identity
3. How to use your synced history:
   - Searching past sessions across machines
   - Asking natural-language questions like "What did I work on last week?"
   - Generating standup reports from synced history
4. Privacy and data considerations:
   - What data is sent to GitHub and how it is stored
   - How to disable sync or delete history if needed

Walk me through enabling Session Sync and running my first history query.`,
  addedIn: '1.123.0',
});
