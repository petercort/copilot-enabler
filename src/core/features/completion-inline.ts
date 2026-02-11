import { defineFeature } from './definition';

export const completionInline = defineFeature({
  id: 'completion-inline',
  name: 'Inline Suggestions',
  category: 'Completion',
  description:
    'Ghost-text code suggestions that appear as you type, accepted with Tab.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/ai-powered-suggestions',
  detectHints: [
    'inlineSuggest',
    'completionAccepted',
    'completionSuggested',
    'completion',
  ],
  tags: ['core'],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    'Enabled by default. Start typing and suggestions appear as ghost text.',
    'Press Tab to accept or Esc to dismiss.',
  ],
});
