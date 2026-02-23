import { defineFeature } from '../definition';

export const coreSubagent = defineFeature({
  id: 'core-subagent',
  name: 'Run Subagent',
  category: 'Core',
  description: 'Subagents in Visual Studio Code provide context isolation and enable you to run tasks in a dedicated context window, separate from the main agent session.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/agents/subagents',
  detectHints: ['subagent', 'tool/runsubagent'],
  impact: 'high',
  difficulty: 'medium',
  setupSteps: [
    'In your prompt or chat message use the phrase "use a subagent" and an agent will spawn or use the command #runSubagent',
  ],
});
