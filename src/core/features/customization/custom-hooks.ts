import { defineFeature } from '../definition';

export const customHooks = defineFeature({
  id: 'custom-hooks',
  name: 'Hooks',
  category: 'Customization',
  description:
    'Execute custom shell commands at key lifecycle points during agent sessions for automation, policy enforcement, and auditing.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/customization/hooks',
  detectHints: ['.github/hooks/*.json', '.claude/settings.local.json', '.claude/settings.json', '~/.claude/settings.json', 'hooks' ],
  impact: 'high',
  difficulty: 'high',
  setupSteps: [
    'Define hook JSON files under .github/hooks/ (for example, .github/hooks/prerun.json).',
    'Use documented lifecycle events (pre/post tool or command hooks) and commands per https://code.visualstudio.com/docs/copilot/customization/hooks.',
    'Apply hooks to enforce security policies, run formatters after edits, or create audit trails.',
  ],
  systemPrompt: `You are helping set up Copilot hooks for lifecycle automation.

Your workflow:
1. Read project context to understand what automation would be valuable.
2. Ask what lifecycle events they want to hook into (file edits, tool invocations, commands).
3. Create or update .github/hooks/*.json with hook configurations.
4. Common hooks: run linters after file edits, block dangerous commands, log tool invocations.
5. Use write_file to create the configuration.

Reference: https://code.visualstudio.com/docs/copilot/customization/hooks — only suggest supported lifecycle events and schema as documented there. Do not invent unsupported hooks.

Start by understanding the project and asking what automations they need.`,
  tutorialPrompt: `I'd like to learn about Copilot Hooks and how I can use them for automation in my workspace.

Please help me understand this feature by:
1. First, examining my workspace to see what tools and processes I have (linters, formatters, test runners, build tools)
2. Asking me about my workflow pain points - what manual steps do I often forget or wish were automated?
3. Based on my responses, suggest 2-3 specific hooks that would be most useful for my project, such as:
   - Running formatters automatically after Copilot makes file edits
   - Enforcing security policies before certain operations
   - Creating audit trails of AI-generated changes
   - Running tests after code modifications
4. For each suggested hook, explain:
   - What lifecycle event it would respond to
   - What command it would run
   - How it would improve my workflow in practice
 5. If I'm interested, show me exactly what the hook configuration would look like in .github/hooks/*.json (using the documented schema).

Reference: https://code.visualstudio.com/docs/copilot/customization/hooks — keep suggestions limited to documented hook points and schema.

Please tailor your suggestions to my actual development environment and tools.`,
});
