import { defineFeature } from './definition';

export const settingModelSelection = defineFeature({
  id: 'setting-model-selection',
  name: 'Model Selection',
  category: 'Chat',
  description:
    'Choose which AI model Copilot uses for suggestions and chat responses.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/copilot-settings',
  detectHints: [
    'github.copilot-chat.models',
    'model selection',
    'modelSelection',
    'languageModel',
    'gpt-4o', 'gpt-4-turbo', 'gpt-4.1',
    'claude-sonnet', 'claude-opus', 'claude-haiku',
    'o1-preview', 'o1-mini', 'o3-mini', 'o4-mini', 'gemini-2',
  ],
  tags: ['advanced'],
  impact: 'high',
  difficulty: 'low',
  setupSteps: [
    'Click the model name in the Copilot Chat panel header to switch models.',
  ],
});
