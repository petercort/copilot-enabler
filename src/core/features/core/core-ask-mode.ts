import { defineFeature } from '../definition';

export const coreAskMode = defineFeature({
  id: 'core-ask-mode',
  name: 'Ask Mode',
  category: 'Core',
  description:
    'Conversational Q&A mode — ask Copilot questions about code, concepts, or your project without making edits.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/chat/chat-modes',
  detectHints: [],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    "Open Copilot Chat and select 'Ask' from the mode picker at the top of the chat panel.",
  ],
});
