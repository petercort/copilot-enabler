import { defineFeature } from '../definition';

export const coreResearchAgent = defineFeature({
  id: 'core-research-agent',
  name: 'Research Agent',
  category: 'Core',
  description:
    'A Copilot agent that performs deep research on any topic and returns a well-cited Markdown report. Powered by a search-capable subagent, it pulls information from your codebase, relevant GitHub repositories, and the public web — without modifying any files.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/agents/research-agent',
  detectHints: ['github.copilot.chat.executionSubagent.enabled', '/research', 'research agent'],
  impact: 'medium',
  difficulty: 'low',
  setupSteps: [
    'Enable `github.copilot.chat.executionSubagent.enabled` in your VS Code settings.',
    'Open Copilot Chat and type `/research <topic>` to start a deep research session.',
    'Review the cited Markdown report returned by the agent.',
    'Follow the inline citations to verify sources and dive deeper into any area of interest.',
  ],
  tutorialPrompt: `I'd like to learn about the Research Agent in VS Code Copilot.

Please help me understand this feature by:
1. What the Research Agent is:
   - How it performs deep research using a search-capable subagent
   - What sources it draws from (codebase, GitHub repos, public web)
   - That it never modifies files — it only produces reports
2. How to enable and use it:
   - Enabling \`github.copilot.chat.executionSubagent.enabled\`
   - Using the /research command in Copilot Chat
   - Understanding the structure of the returned Markdown report and its citations
3. Practical use cases:
   - Onboarding to a new codebase or library
   - Researching an unfamiliar API before writing integration code
   - Gathering background information on a bug or security vulnerability
4. Limitations and best practices:
   - When to use the Research Agent vs. regular chat
   - How to refine a research query for better results

Walk me through running my first /research query.`,
  addedIn: '1.123.0',
});
