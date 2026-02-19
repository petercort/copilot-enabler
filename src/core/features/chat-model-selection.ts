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
  tutorialPrompt: `I'd like to learn about Model Selection in GitHub Copilot and how to choose the right AI model for my tasks.

Please help me understand this feature by:
1. What model selection is and why it matters:
   - Different AI models have different strengths
   - How model choice affects suggestions and chat quality
   - When to use different models for different tasks
2. Available models and their characteristics:
   - Fast models (like Claude Haiku or GPT-4 Mini): Quick for simple questions, low latency
   - Balanced models (like Claude Sonnet or GPT-4 Turbo): Good for most development tasks
   - Advanced models (like Claude Opus or o3-mini): Best for complex reasoning and edge cases
   - Specialized models: Optimized for specific domains
3. How to switch models:
   - Clicking the model selector in the Copilot Chat panel
   - When to switch models during a session
   - Persisting your model choice
4. Matching models to tasks:
   - Simple refactoring → Faster models
   - Complex architectural decisions → Advanced models
   - Quick explanations → Lightweight models
5. Cost and performance tradeoffs:
   - Speed vs. quality considerations
   - When to spend more tokens for better answers

Help me experiment with different models for my actual coding tasks.`,
});
