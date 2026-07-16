import { defineFeature } from '../definition';

export const customMcpServers = defineFeature({
  id: 'custom-mcp-servers',
  name: 'MCP Servers',
  category: 'Customization',
  description:
    'Connect external tools and data sources to Copilot through the Model Context Protocol (MCP). Supports OAuth client credentials (`clientId` in the `oauth` section of `mcp.json`) and an enterprise-managed cross-app authorization (XAA) flow for org-controlled identity provider authentication.',
  docsURL: 'https://code.visualstudio.com/docs/copilot/customization/mcp-servers',
  detectHints: [
    '.vscode/mcp.json',
    'mcp.json',
    'mcp server started',
    'mcp server',
  ],
  impact: 'high',
  difficulty: 'high',
  setupSteps: [
    'Install MCP servers from the MCP gallery in the Extensions view or add entries to `.vscode/mcp.json`.',
    'Choose to install servers in your user profile or workspace (`.vscode/mcp.json`) to share with the team.',
    'Define `servers` and optional `inputs` (placeholders for secrets) following the MCP configuration schema; supports `stdio`, `http`, and `sse` transports.',
    'For OAuth-protected servers, add a `clientId` field inside the `oauth` section of the server entry in `mcp.json`.',
    'For enterprise environments, use the cross-app authorization (XAA) flow: your organization\'s identity provider manages MCP server authentication automatically.',
    'Start the MCP server (VS Code will prompt to trust the server) and use the Tools picker in Chat to enable MCP tools.',
  ],
  systemPrompt: `You are helping set up MCP server configuration for Copilot.

Your workflow:
1. Read project context to understand what external tools would help.
2. Ask what MCP servers they want (GitHub, database, API integrations) and whether they should be workspace or user-scoped.
3. Generate or update '.vscode/mcp.json' with 'servers' and 'inputs' entries, choosing appropriate transports ('stdio', 'http', 'sse') and example 'command'/'url' values.
4. For OAuth-protected servers, include the 'clientId' field inside the 'oauth' section of the server entry.
5. Explain trust and security implications (trust prompt, input variables for secrets, enterprise XAA for org-managed auth) and how to start the server.
6. Show examples for 'stdio' and 'http' server configurations and how to use the Tools picker or 'MCP: Reset Cached Tools' when needed.
7. Use write_file to create or update '.vscode/mcp.json' if the user approves.

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
   - Walk me through what the configuration would look like, including OAuth clientId if needed
6. If I'm interested, show me what my .vscode/mcp.json would look like with the suggested servers
7. If I'm in an enterprise environment, explain how the cross-app authorization (XAA) flow simplifies org-managed MCP authentication

Please make this practical and specific to my workspace and workflow.`,
  addedIn: '1.110.0',
});
