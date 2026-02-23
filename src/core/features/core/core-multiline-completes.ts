import { defineFeature } from '../definition';

export const coreMultilineCompletes = defineFeature({
  id: 'core-multiline-completes',
  name: 'Multi-line Completions',
  category: 'Core',
  description:
    'Copilot generates multi-line code blocks including entire functions or control structures.',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/ai-powered-suggestions',
  detectHints: ['multi-line', 'multiline', 'completion', 'inlineSuggest', 'xtabprovider', 'fetchcompletions', 'streamchoices', 'postinsertion'],
  impact: 'low',
  difficulty: 'low',
  setupSteps: [
    'Write a comment or function signature, then pause — Copilot will suggest a multi-line completion.',
  ],
  tutorialPrompt: `I'd like to learn how to leverage multi-line completions in GitHub Copilot to write code faster.

Please help me understand this feature by:
1. Explaining how multi-line completions work:
   - When Copilot suggests multiple lines of code
   - How good comments or function signatures trigger better completions
   - Why context matters for accuracy
2. Showing me best practices for getting high-quality completions:
   - Writing descriptive comments that guide Copilot
   - Structuring function signatures clearly
   - Using context like imports and variable names
3. Demonstrating workflows for different coding tasks:
   - Implementing loops and conditionals
   - Writing error handling blocks
   - Creating helper functions
4. How to evaluate and modify suggestions:
   - When to accept, modify, or reject suggestions
   - How to quickly edit suggestions inline
5. Common patterns in my codebase that Copilot can learn from

Walk me through practical examples using my actual project code.`,
});
