import { defineFeature } from '../definition';

export const toolsSandboxNetworkRetry = defineFeature({
  id: 'tools-sandbox-network-retry',
  name: 'Sandbox Network Command Retry',
  category: 'Tools',
  description:
    'When a local agent executes a terminal command that requires network access to a domain not on the pre-approved list, VS Code automatically retries the command in a sandbox with full network access — and falls back to unsandboxed execution if needed — while still protecting your filesystem.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/chat/tools',
  detectHints: ['chat.agent.sandbox.retryWithAllowNetworkRequests'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Enable `chat.agent.sandbox.retryWithAllowNetworkRequests` in your VS Code settings.',
    'Start a local agent session that runs terminal commands requiring network access (e.g., `git fetch`, `npm install`).',
    'If a command fails due to network restrictions, VS Code retries it in a sandbox with full network access.',
    'If the retry still fails, VS Code falls back to unsandboxed execution as a last resort.',
  ],
  addedIn: '1.123.0',
});
