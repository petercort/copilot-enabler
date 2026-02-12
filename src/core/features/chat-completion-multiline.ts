import { defineFeature } from './definition';

export const completionMultiline = defineFeature({
  id: 'completion-multiline',
  name: 'Multi-line Completions',
  category: 'Chat',
  description:
    'Copilot generates multi-line code blocks including entire functions or control structures.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/ai-powered-suggestions',
  detectHints: ['multi-line', 'multiline', 'completion', 'inlineSuggest'],
  tags: ['core'],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    'Write a comment or function signature, then pause — Copilot will suggest a multi-line completion.',
  ],
});
