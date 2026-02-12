import { defineFeature } from './definition';

export const modeEdit = defineFeature({
  id: 'mode-edit',
  name: 'Edit Mode',
  category: 'Agents',
  description:
    'Direct editing mode — Copilot applies changes to your files in-place with a diff review before accepting.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/chat/chat-modes',
  detectHints: ['edit mode', 'editMode', 'mode:edit', 'copilot-edits'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    "Open Copilot Chat and select 'Edit' from the mode picker.",
    'Describe the change you want and Copilot will produce a diff.',
  ],
});
