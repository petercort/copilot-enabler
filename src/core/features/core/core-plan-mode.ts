import { defineFeature } from '../definition';

export const corePlanMode = defineFeature({
  id: 'core-plan-mode',
  name: 'Plan Mode',
  category: 'Core',
  description:
    'Use the Plan agent to break a task into a structured implementation plan before writing any code. Analyze your codebase, ask clarifying questions, and produce a step-by-step plan.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/agents/planning',
  detectHints: [],
  impact: 'high',
  difficulty: 'low',
  setupSteps: [
    "Open Copilot Chat and select 'Plan' from the mode picker.",
    'Describe the feature or task and Copilot will create a structured plan before any code is written.',
    'Once satisfied, hand off the plan to an implementation agent.',
  ],
});
