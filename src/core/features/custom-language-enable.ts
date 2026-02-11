import { defineFeature } from './definition';

export const customLanguageEnable = defineFeature({
  id: 'custom-language-enable',
  name: 'Language-Specific Enablement',
  category: 'Customization',
  description:
    'Enable or disable Copilot for specific programming languages via settings.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/copilot-customization',
  detectHints: ['github.copilot.enable', 'copilot.enable'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Open VS Code settings and search for github.copilot.enable.',
    'Set per-language overrides, e.g. "python": true, "markdown": false.',
  ],
});
