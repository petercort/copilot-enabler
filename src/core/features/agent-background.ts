import { defineFeature } from './definition';

export const agentBackground = defineFeature({
  id: 'agent-background',
  name: 'Background Agents',
  category: 'Agents',
  description:
    'CLI-based agents that run non-interactively in the background on your local machine using Git worktrees, isolated from your main workspace.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/agents/background-agents',
  detectHints: ['background agent', 'copilot cli', 'worktree'],
  tags: ['advanced', 'new'],
  impact: 'high',
  difficulty: 'medium',
  setupSteps: [
    'Open the Chat view and select the New Session dropdown.',
    "Choose 'Background' as the agent type to start a background agent session.",
    'The agent works in an isolated Git worktree so it won\'t conflict with your active workspace.',
  ],
});
