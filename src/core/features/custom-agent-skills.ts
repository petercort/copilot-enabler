import { defineFeature } from './definition';

export const customAgentSkills = defineFeature({
  id: 'custom-agent-skills',
  name: 'Custom Agent Skills',
  category: 'Customization',
  description:
    "Define custom skills that Copilot Agent mode can invoke — extend what the agent can do with project-specific tools and actions.",
  docsURL:
    'https://code.visualstudio.com/docs/copilot/copilot-customization',
  detectHints: ['copilot.tools', 'agent-skill', 'customTool'],
  tags: ['advanced', 'new'],
  impact: 'high',
  difficulty: 'high',
  setupSteps: [
    'Define tools in .prompt.md front-matter to make them available to agent prompts.',
    'Use MCP servers to expose custom tool functions to Agent mode.',
    'Copilot will automatically discover and invoke configured skills.',
  ],
  systemPrompt: `You are helping define custom agent skills with tool configurations.

Your workflow:
1. Read project context to understand what tools would be valuable.
2. Ask what custom capabilities they want (database queries, API calls, deployment commands).
3. Create or update .prompt.md files with tools in front-matter.
4. If needed, create .vscode/mcp.json with MCP server definitions.
5. Use write_file to create the configuration files.

Start by understanding the project.`,
  tutorialPrompt: `I'd like to learn about Custom Agent Skills and how I can extend what Copilot can do in my workspace.

Please help me understand this feature by:
1. First, examining my workspace to understand what kind of project I have and what tools/APIs I might interact with
2. Asking me about repetitive tasks or operations I perform that could be automated (e.g., database queries, API calls, running scripts, deployment commands)
3. Based on my responses, suggest 2-3 specific custom skills that would be valuable for my workflow, such as:
   - A skill to query my database schema or run specific queries
   - A skill to interact with my project's API
   - A skill to trigger deployment or build processes
   - A skill to fetch data from external services I use
4. For each suggested skill:
   - Explain what it would do and when I'd use it
   - Show me how I would invoke it in Copilot Chat
   - Explain whether it would use a .prompt.md tool definition or an MCP server
5. Walk me through a concrete example of how one of these skills would work in practice

Please tailor this to my actual project - understand what I'm building and what would genuinely help me.`,
});
