import { defineFeature } from './definition';

export const smartActions = defineFeature({
  id: 'smart-actions',
  name: 'Smart Actions',
  category: 'Chat',
  description:
    'Predefined AI-powered actions for common tasks: generating commit messages, renaming symbols, fixing errors, and running semantic search across your project.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/copilot-smart-actions',
  detectHints: ['smart action', 'generate commit message', 'copilot fix', 'copilot rename'],
  tags: ['core'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Right-click on code in the editor and look for Copilot actions in the context menu.',
    'Use the lightbulb (Quick Fix) menu to see AI-powered fix suggestions.',
    'In the Source Control view, click the sparkle icon to generate a commit message.',
  ],
  tutorialPrompt: `I'd like to learn about Smart Actions in GitHub Copilot and how they can speed up my daily tasks.

Please help me understand this feature by:
1. What Smart Actions are:
   - Prebuilt Copilot features for common development tasks
   - Where to find and trigger them in the editor
   - Why they're faster than asking in chat
2. Key Smart Actions and their uses:
   - Generate Commit Messages: Automatically write meaningful commit messages from your changes
   - Fix Issues: Get AI-powered suggestions for fixing errors and warnings
   - Rename Symbols: Refactor variable/function names intelligently across your codebase
   - Semantic Search: Find related code by meaning, not just text matching
3. How to trigger Smart Actions:
   - Right-click on code for context menu actions
   - Use lightbulb (Quick Fix, usually Cmd+. or Ctrl+.)
   - Source Control view sparkle icon for commit messages
4. Workflows with Smart Actions:
   - Pre-commit: Generate good commit messages quickly
   - During coding: Fix errors as you encounter them
   - Refactoring: Rename symbols with confidence across files
5. Practical examples from my routine:
   - Generating commit messages for my recent changes
   - Fixing common error patterns in my code
   - Renaming symbols in my current project

Walk me through using Smart Actions with my actual work in progress.`,
});
