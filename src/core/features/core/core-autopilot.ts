import { defineFeature } from '../definition';

export const coreAutopilot = defineFeature({
  id: 'core-autopilot',
  name: 'Autopilot Mode',
  category: 'Core',
  description:
    'Let agents run fully autonomously — auto-approving tool calls, retrying errors, and completing questions without interruption until the entire task is done.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/agents/agent-tools',
  detectHints: ['chat.autopilot.enabled', 'autopilot', 'bypass approvals', 'task_complete'],
  impact: 'high',
  difficulty: 'low',
  setupSteps: [
    'Enable Autopilot in Stable by setting `chat.autopilot.enabled` to `true`.',
    'In the Chat view, open the permissions picker beside the chat input and select "Autopilot".',
    'For lighter autonomy, choose "Bypass Approvals" to auto-approve tool calls without full auto-completion.',
    'The agent will iterate until it calls `task_complete`, then hand control back to you.',
  ],
  systemPrompt: `You are helping configure Copilot Autopilot mode.

Your workflow:
1. Confirm the user is on VS Code 1.111 or later.
2. Check whether \`chat.autopilot.enabled\` is already set in settings.json.
3. If not, add "chat.autopilot.enabled": true to the workspace or user settings.json.
4. Explain the three permission levels: Default Approvals, Bypass Approvals, and Autopilot.
5. Remind the user that Autopilot bypasses all confirmation dialogs — only use it for trusted tasks.

Reference: https://code.visualstudio.com/docs/copilot/agents/agent-tools — keep guidance accurate to documented permission levels.`,
  tutorialPrompt: `I'd like to learn about Copilot Autopilot mode and agent permissions.

Please help me understand this feature by:
1. What Autopilot mode is:
   - How agents can run fully autonomously until a task is complete
   - The three permission levels: Default Approvals, Bypass Approvals, and Autopilot
   - When to use each level and the security trade-offs
2. How to enable Autopilot:
   - Setting \`chat.autopilot.enabled\` in VS Code settings
   - Using the permissions picker in the Chat view
3. Practical workflows for Autopilot:
   - Multi-step refactors and large edits with no interruptions
   - Running tests, fixing errors, and iterating automatically
   - When to prefer Default Approvals for sensitive tasks
4. Safety considerations:
   - Why Bypass Approvals and Autopilot bypass confirmation dialogs
   - How to recover if the agent makes an unwanted change

Walk me through setting it up for a real task in my workspace.`,
  addedIn: '1.111.0',
});
