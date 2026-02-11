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
});
