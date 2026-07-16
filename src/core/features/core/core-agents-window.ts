import { defineFeature } from '../definition';

export const coreAgentsWindow = defineFeature({
  id: 'core-agents-window',
  name: 'Agents Window',
  category: 'Core',
  description:
    'A dedicated VS Code window purpose-built for agent-driven development across multiple projects. Lets you explore, iterate, and review agentic tasks across multiple sessions open side by side, while choosing your agent harness and running agents on remote machines.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/agents/agents-window',
  detectHints: ['extensions.supportAgentsWindow'],
  impact: 'high',
  difficulty: 'low',
  setupSteps: [
    'Click the "Open in Agents" button in the VS Code title bar to launch the Agents window.',
    'Create a new session and pick an agent harness (e.g., Copilot, Copilot CLI).',
    'Open multiple agent sessions side by side from the session list to compare or run tasks in parallel.',
    'To enable an extension in the Agents window, add its ID to the `extensions.supportAgentsWindow` setting.',
  ],
  addedIn: '1.120.0',
});
