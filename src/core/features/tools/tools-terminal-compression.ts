import { defineFeature } from '../definition';

export const toolsTerminalCompression = defineFeature({
  id: 'tools-terminal-compression',
  name: 'Terminal Tool Output Compression',
  category: 'Tools',
  description:
    'Reduces context window usage by compressing large terminal output before it is sent to the model. Collapses unchanged diff hunks, strips lockfile noise, and removes npm install progress bars so the model spends tokens on the code that matters.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/chat/tools',
  detectHints: ['chat.tools.compressOutput.enabled'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Enable `chat.tools.compressOutput.enabled` in your VS Code settings.',
    'Run agent tasks that produce large terminal output (e.g., `git diff`, `npm install`).',
    'Verify that the compressed output banner appears in the model context, confirming filters fired.',
    'Disable `chat.tools.compressOutput.enabled` in settings if you need the model to see raw terminal output.',
  ],
  addedIn: '1.120.0',
});
