import { defineFeature } from './definition';

export const modePlan = defineFeature({
  id: 'mode-plan',
  name: 'Plan Mode',
  category: 'Agents',
  description:
    'Use the Plan agent to break a task into a structured implementation plan before writing any code. Analyze your codebase, ask clarifying questions, and produce a step-by-step plan.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/agents/planning',
  detectHints: ['plan mode', 'planMode', 'mode:plan', 'plan agent'],
  tags: ['core'],
  impact: 'high',
  difficulty: 'low',
  setupSteps: [
    "Open Copilot Chat and select 'Plan' from the mode picker.",
    'Describe the feature or task and Copilot will create a structured plan before any code is written.',
    'Once satisfied, hand off the plan to an implementation agent.',
  ],
});
