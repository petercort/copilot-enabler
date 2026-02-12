import { defineFeature } from './definition';

export const modeAsk = defineFeature({
  id: 'mode-ask',
  name: 'Ask Mode',
  category: 'Agents',
  description:
    'Conversational Q&A mode — ask Copilot questions about code, concepts, or your project without making edits.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/chat/chat-modes',
  detectHints: ['ask mode', 'askMode', 'mode:ask'],
  tags: ['core'],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    "Open Copilot Chat and select 'Ask' from the mode picker at the top of the chat panel.",
  ],
});
