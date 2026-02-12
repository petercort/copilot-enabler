import { defineFeature } from './definition';

export const completionNes = defineFeature({
  id: 'completion-nes',
  name: 'Next Edit Suggestions (NES)',
  category: 'Chat',
  description:
    'Copilot predicts your next likely edit location and suggests changes proactively.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/ai-powered-suggestions#_next-edit-suggestions',
  detectHints: ['next edit', 'nextEdit', 'github.copilot.nexteditsuggestions'],
  tags: ['advanced', 'new'],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    'Enable in settings: github.copilot.nextEditSuggestions.enabled = true',
    "Copilot will highlight the next location it thinks you'll edit.",
  ],
});
