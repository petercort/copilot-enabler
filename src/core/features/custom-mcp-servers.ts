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
});
