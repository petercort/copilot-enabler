// Template for creating new feature definitions
// Copy this file and fill in the details for your new feature

import { defineFeature } from './definition';

export const featureTemplate = defineFeature({
  id: 'your-feature-id',
  name: 'Your Feature Name',
  category: 'Chat', // Modes | Chat | Completion | Customization | Context
  description: 'A brief description of what this feature does and its benefits.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/...',
  detectHints: [
    'keyword1',
    'keyword2',
    'setting.name',
  ],
  tags: ['core'], // core | advanced | new | enterprise
  impact: 'medium', // low | medium | high
  difficulty: 'low', // low | medium | high
  setupSteps: [
    'Step 1: Explain how to enable or configure this feature.',
    'Step 2: Additional setup instructions if needed.',
  ],
  // Optional: Include a system prompt for interactive implementation
  // systemPrompt: `You are helping set up [feature name]...`,
});
