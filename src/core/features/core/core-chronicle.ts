import { defineFeature } from '../definition';

export const coreChronicle = defineFeature({
  id: 'core-chronicle',
  name: 'Chronicle (Chat History Insights)',
  category: 'Core',
  description:
    'Chronicle indexes your chat history locally so you can generate standup reports, get personalized prompting tips, and query past sessions to recall what you worked on.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/chat/chat-sessions',
  detectHints: ['github.copilot.chat.localIndex.enabled', 'chronicle', '/chronicle'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Enable Chronicle via the `github.copilot.chat.localIndex.enabled` setting.',
    'Use `/chronicle:standup` in Chat to generate a standup report from the last 24 hours.',
    'Use `/chronicle:tips` to get personalized tips based on 7 days of usage history.',
    'Use `/chronicle [query]` for free-form queries, e.g. "what files did I edit yesterday?"',
  ],
  systemPrompt: `You are helping the user set up and use Chronicle, the Copilot chat history indexing feature.

Your workflow:
1. Confirm the user is on VS Code 1.118 or later.
2. Enable \`github.copilot.chat.localIndex.enabled\` in user or workspace settings if it is not already on.
3. Explain the three commands: /chronicle:standup, /chronicle:tips, and /chronicle [query].
4. Help the user run their first query, such as a standup for the last 24 hours.
5. Remind the user that the database is stored locally and never sent to any server.

Reference: https://code.visualstudio.com/docs/copilot/chat/chat-sessions — keep suggestions accurate to documented Chronicle commands.`,
  tutorialPrompt: `I'd like to learn about Chronicle, the Copilot chat history and session insights feature.

Please help me understand this feature by:
1. What Chronicle is:
   - How it indexes chat history in a local SQLite database
   - What it records (session metadata, files touched, PRs, issues, commit references)
   - Privacy considerations (all data stays local)
2. How to enable it:
   - Setting \`github.copilot.chat.localIndex.enabled\` to true
3. The three Chronicle commands:
   - /chronicle:standup — standup report for the last 24 hours grouped by branch/feature
   - /chronicle:tips — personalized prompting and workflow improvement tips from 7 days of history
   - /chronicle [query] — free-form natural language queries, e.g. "what files did I edit yesterday?"
4. Practical daily workflows:
   - Running a standup report before a team sync
   - Learning which tools and prompting patterns you use most
   - Quickly recalling context from sessions a few days ago

Help me run my first Chronicle query based on my recent coding sessions.`,
  addedIn: '1.118.0',
});
