import { defineFeature } from '../definition';

export const coreRemoteAgents = defineFeature({
  id: 'core-remote-agents',
  name: 'Remote Agent Sessions',
  category: 'Core',
  description:
    'Run Copilot agent sessions on a remote machine via SSH or dev tunnels from the Agents window. Sessions continue running on the remote even when your laptop is closed, and the Agent Host Protocol keeps every client in sync.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/concepts/agents#_remote-agent-sessions',
  detectHints: ['agents.remote', 'code tunnel', 'agent host protocol', 'ahp'],
  impact: 'high',
  difficulty: 'medium',
  setupSteps: [
    'Open the Agents window via the "Open in Agents" button in the VS Code title bar.',
    'Switch to the Remote tab and connect via SSH (pick a `~/.ssh/config` entry or enter `user@host`) or via Dev Tunnels (select a tunnel started with `code tunnel`).',
    'Create an agent session — it runs on the remote machine and continues even if you disconnect.',
    'Reconnect at any time to resume monitoring or steering the session.',
  ],
  tutorialPrompt: `I'd like to learn how to run Copilot agent sessions on a remote machine using the Agents window.

Please help me understand this feature by:
1. What remote agent sessions are:
   - How the Agents window connects to a remote machine via SSH or dev tunnels
   - How sessions continue running even after you close your laptop
   - The Agent Host Protocol (AHP) and how it keeps clients in sync
2. How to set it up:
   - Opening the Agents window and switching to the Remote tab
   - Connecting via SSH using ~/.ssh/config entries
   - Connecting via Dev Tunnels started with \`code tunnel\`
3. Using remote sessions in practice:
   - Starting an agent session on the remote host
   - Reconnecting to an in-progress session from another device
   - Monitoring progress and steering the agent remotely
4. Security and resource considerations:
   - How VS Code CLI is bootstrapped on the remote (SSH vs. dev tunnel)
   - Long-lived agent host processes and cleanup

Walk me through connecting to a remote machine and starting an agent session.`,
  addedIn: '1.121.0',
});
