import { defineFeature } from '../definition';

export const coreCliRemote = defineFeature({
  id: 'core-cli-remote',
  name: 'Remote Control for Copilot CLI',
  category: 'Core',
  description:
    'Monitor and steer ongoing Copilot CLI sessions remotely from GitHub.com or the GitHub mobile app — respond to approvals and keep work moving without being tied to your machine.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/agents/copilot-cli',
  detectHints: ['github.copilot.chat.cli.remote.enabled', '/remote on', 'copilot cli remote'],
  impact: 'medium',
  difficulty: 'medium',
  setupSteps: [
    'Enable remote control via the `github.copilot.chat.cli.remote.enabled` setting.',
    'Start a Copilot CLI session and enter `/remote on` in chat to activate remote access.',
    'Navigate to GitHub.com or the GitHub mobile app to monitor and respond to pending approvals.',
    'Run `/remote` at any time to check status, or `/remote off` to disable remote access.',
  ],
  tutorialPrompt: `I'd like to learn about remote control for Copilot CLI sessions.

Please help me understand this feature by:
1. What remote control for Copilot CLI is:
   - How you can monitor and steer CLI sessions from GitHub.com or the GitHub mobile app
   - Scenarios where remote control is useful (stepping away from desk, multi-tasking)
   - How approvals and task steering work remotely
2. How to set it up:
   - Enabling \`github.copilot.chat.cli.remote.enabled\`
   - Starting a CLI session and running /remote on
   - Linking to GitHub.com for remote access
3. Using remote control in practice:
   - Viewing session progress from the GitHub.com interface
   - Approving or rejecting tool calls remotely
   - Steering the agent with new messages while away
4. Disabling and managing remote sessions:
   - Using /remote off to end remote access
   - Security considerations for remote session control

Walk me through setting up a remote CLI session for a real task.`,
  addedIn: '1.118.0',
});
