import { defineFeature } from '../definition';

export const coreUtilityModels = defineFeature({
  id: 'core-utility-models',
  name: 'Utility Model Configuration',
  category: 'Core',
  description:
    'Override the AI models VS Code uses in the background for lightweight tasks such as generating commit messages, chat titles, rename suggestions, and intent detection. Useful for controlling cost and latency or for routing these flows through a Bring Your Own Key (BYOK) model.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/customization/language-models',
  detectHints: ['chat.utilityModel', 'chat.utilitySmallModel'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Open VS Code Settings and search for `chat.utilityModel`.',
    'Set `chat.utilityModel` to your preferred model for general utility flows (e.g., commit message generation, chat titles).',
    'Optionally set `chat.utilitySmallModel` to a fast, inexpensive model for lightweight flows.',
    'Leave either setting as **Default** to continue using the GitHub Copilot-provided utility model.',
  ],
  tutorialPrompt: `I'd like to learn how to configure the utility models VS Code uses for background tasks like commit messages and chat titles.

Please help me understand this feature by:
1. What utility models are:
   - The background tasks that use utility models (commit messages, titles, rename suggestions, intent detection)
   - Why you might want to override these models (cost, latency, BYOK)
   - The difference between \`chat.utilityModel\` and \`chat.utilitySmallModel\`
2. How to configure them:
   - Setting \`chat.utilityModel\` for general utility flows
   - Setting \`chat.utilitySmallModel\` for fast, lightweight flows
   - Choosing between Default and a custom model
3. Practical scenarios:
   - Routing utility tasks through a BYOK model
   - Reducing cost by selecting a smaller model for utility flows
   - When to leave the settings as Default

Walk me through choosing and configuring utility models for my setup.`,
  addedIn: '1.121.0',
});
