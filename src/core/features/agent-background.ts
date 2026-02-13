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
    systemPrompt: `Explain the new Background Agents feature in VS Code Copilot. These are CLI-based agents that run non-interactively in the background on the user's local machine. They use Git worktrees to create isolated environments separate from the user's main workspace, allowing them to perform tasks without interfering with active development.

Your workflow:
1. Read project context using list_directory and read_file.
2. Explain how to start a background agent session from the Chat view.
3. Describe how the agent operates in an isolated Git worktree and its benefits.

Start by understanding the project.`,
});
