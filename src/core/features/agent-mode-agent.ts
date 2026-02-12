import { defineFeature } from './definition';

export const modeAgent = defineFeature({
  id: 'mode-agent',
  name: 'Agent Mode',
  category: 'Agents',
  description:
    'Autonomous agent mode — Copilot plans multi-step tasks, runs terminal commands, and edits multiple files.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/chat/chat-modes',
  detectHints: ['agent mode', 'agentMode', 'mode:agent', 'agentic'],
  tags: ['core', 'advanced'],
  impact: 'high',
  difficulty: 'low',
  setupSteps: [
    "Open Copilot Chat and select 'Agent' from the mode picker.",
    'Describe a multi-step task and Copilot will plan and execute it.',
  ],
});
