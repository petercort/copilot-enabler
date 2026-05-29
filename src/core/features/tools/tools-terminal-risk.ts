import { defineFeature } from '../definition';

export const toolsTerminalRisk = defineFeature({
  id: 'tools-terminal-risk',
  name: 'Terminal Command Risk Assessment',
  category: 'Tools',
  description:
    'Adds an AI-generated risk badge and one-sentence explanation to terminal command confirmations so you can quickly decide whether a command deserves a closer look before approving it.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/chat/tools',
  detectHints: ['chat.tools.riskAssessment.enabled'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Enable `chat.tools.riskAssessment.enabled` in your VS Code settings.',
    'Start an agent session that runs terminal commands.',
    'Review the risk badge (Safe / Caution / Review carefully) and summary shown on each command confirmation.',
    'Approve or reject commands based on the risk level before the agent proceeds.',
  ],
  addedIn: '1.120.0',
});
