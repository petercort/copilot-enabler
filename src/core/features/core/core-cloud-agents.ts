import { defineFeature } from '../definition';

export const coreCloudAgents = defineFeature({
  id: 'core-cloud-agents',
  name: 'Cloud Agents',
  category: 'Core',
  description:
    'Agents that run on remote infrastructure and integrate with GitHub repositories and pull requests for team collaboration and code reviews.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/agents/cloud-agents',
  detectHints: [],
  impact: 'high',
  difficulty: 'medium',
  setupSteps: [
    'Open the Chat view and select the New Session dropdown.',
    "Choose 'Cloud' as the agent type to start a cloud agent session.",
    'The agent creates a branch, implements changes, and opens a pull request for team review.',
    'Install the GitHub Pull Requests extension for full integration.',
  ],
});
