import { defineFeature } from '../definition';

export const coreNes = defineFeature({
  id: 'core-nes',
  name: 'Next Edit Suggestions (NES)',
   category: 'Core',
  description:
    'Copilot predicts your next likely edit location and suggests changes proactively.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/ai-powered-suggestions#_next-edit-suggestions',
  detectHints: ['next edit', 'nextEdit', 'github.copilot.nexteditsuggestions', 'nes.nextcursorposition', 'nes-callisto'],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    'Enable in settings: github.copilot.nextEditSuggestions.enabled = true',
    "Copilot will highlight the next location it thinks you'll edit.",
  ],
  tutorialPrompt: `I'd like to learn about Next Edit Suggestions in GitHub Copilot and how it can accelerate my coding.

Please help me understand this feature by:
1. Explaining how Next Edit Suggestions work:
   - How Copilot predicts where you'll edit next
   - What patterns it learns from your coding style
   - Why this saves time compared to traditional suggestions
2. How to enable and use it effectively:
   - The settings to configure NES
   - How to interpret Copilot's predictions (highlighted areas)
   - How to navigate to suggested edit locations quickly
3. When NES is most useful:
   - During refactoring when you're making related changes
   - When updating multiple related functions
   - Batch editing across a codebase
   - Following a checklist of related edits
4. How NES learns from my patterns:
   - What coding patterns it tracks
   - How my editing history influences suggestions
5. Tips for best results:
   - Making consistent, related edits
   - Using NES feedback to improve your workflow

Show me practical examples with real refactoring scenarios from my code.`,
});
