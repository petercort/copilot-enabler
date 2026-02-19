import { defineFeature } from './definition';

export const skillMcpServers = defineFeature({
  id: 'skill-mcp-servers',
  name: 'MCP Servers',
  category: 'Customization',
  description:
    'Connect external tools and data sources to Copilot through the Model Context Protocol (MCP).',
  docsURL:
    'https://code.visualstudio.com/docs/copilot/chat/mcp-servers',
  detectHints: [
    'mcp.json',
    'mcpServers',
    'mcp-server',
    'mcp server',
    'model context protocol',
  ],
  tags: ['advanced', 'new'],
  impact: 'high',
  difficulty: 'high',
  setupSteps: [
    'Create .vscode/mcp.json in your workspace.',
    'Define MCP server connections with their transport and command.',
    'Copilot Agent mode will automatically discover and use configured MCP tools.',
  ],
  systemPrompt: `You are helping set up MCP server configuration for Copilot.

Your workflow:
1. Read project context to understand what external tools would help.
2. Ask what MCP servers they want (GitHub, database, API integrations).
3. Generate .vscode/mcp.json with server configurations.
4. Explain how each server will be used by Agent mode.
5. Use write_file to create .vscode/mcp.json.

Start by understanding the project and asking what integrations they need.`,
  tutorialPrompt: `I'd like to learn about MCP Servers and how they can connect external tools and data to Copilot in my workspace.

Please help me understand this feature by:
1. First, examining my workspace to understand what external tools, APIs, or data sources I might benefit from connecting to Copilot
2. Explaining what the Model Context Protocol (MCP) is and why it's useful, using simple language
3. Asking me about what external integrations would help me most, such as:
   - GitHub repositories and issues
   - Database access for querying schemas or data
   - APIs I frequently interact with
   - File systems or cloud storage
   - Other development tools
4. Based on my responses, suggest 2-3 specific MCP servers that would be most valuable, such as:
   - @modelcontextprotocol/server-github for GitHub integration
   - @modelcontextprotocol/server-filesystem for file operations
   - Other relevant MCP servers for my use case
5. For each suggested server:
   - Explain what capabilities it would give Copilot
   - Show me concrete examples of how I'd use it (e.g., "Ask Copilot to check open issues on my repo")
   - Walk me through what the configuration would look like
6. If I'm interested, show me what my .vscode/mcp.json would look like with the suggested servers

Please make this practical and specific to my workspace and workflow.`,
});
