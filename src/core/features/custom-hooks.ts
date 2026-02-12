import { defineFeature } from './definition';

export const customHooks = defineFeature({
  id: 'custom-hooks',
  name: 'Hooks',
  category: 'Customization',
  description:
    'Execute custom shell commands at key lifecycle points during agent sessions for automation, policy enforcement, and auditing.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/customization/hooks',
  detectHints: ['hooks', 'copilot.hooks', 'lifecycle hook'],
  tags: ['advanced', 'new'],
  impact: 'high',
  difficulty: 'high',
  setupSteps: [
    'Configure hooks in your .vscode/settings.json under github.copilot.chat.hooks.',
    'Define commands to run at lifecycle events like before/after file edits or tool invocations.',
    'Use hooks to enforce security policies, run formatters after edits, or create audit trails.',
  ],
  systemPrompt: `You are helping set up Copilot hooks for lifecycle automation.

Your workflow:
1. Read project context to understand what automation would be valuable.
2. Ask what lifecycle events they want to hook into (file edits, tool invocations, commands).
3. Create or update .vscode/settings.json with hook configurations.
4. Common hooks: run linters after file edits, block dangerous commands, log tool invocations.
5. Use write_file to create the configuration.

Start by understanding the project and asking what automations they need.`,
});
