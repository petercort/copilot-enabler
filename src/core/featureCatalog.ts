// Port of internal/features/feature.go + catalog.go

/** Category represents a grouping of Copilot features. */
export type Category =
  | 'Modes'
  | 'Chat'
  | 'Completion'
  | 'Customization'
  | 'Context';

/** AllCategories returns every category in display order. */
export const allCategories: Category[] = [
  'Modes',
  'Chat',
  'Completion',
  'Customization',
  'Context',
];

/** Feature describes a single Copilot capability. */
export interface Feature {
  id: string;
  name: string;
  category: Category;
  description: string;
  docsURL: string;
  detectHints: string[];
  tags: string[];
  impact: 'low' | 'medium' | 'high';
  difficulty: 'low' | 'medium' | 'high';
  setupSteps: string[];
}

/** FeaturesByCategory groups a slice of features by their category. */
export function featuresByCategory(all: Feature[]): Map<Category, Feature[]> {
  const out = new Map<Category, Feature[]>();
  for (const f of all) {
    const list = out.get(f.category) ?? [];
    list.push(f);
    out.set(f.category, list);
  }
  return out;
}

/** FeatureIDs returns just the IDs from a slice of features. */
export function featureIDs(all: Feature[]): string[] {
  return all.map((f) => f.id);
}

/** Catalog returns the full registry of known Copilot features. */
export function catalog(): Feature[] {
  return [
    // ── Modes ──
    {
      id: 'mode-ask',
      name: 'Ask Mode',
      category: 'Modes',
      description:
        'Conversational Q&A mode — ask Copilot questions about code, concepts, or your project without making edits.',
      docsURL: 'https://code.visualstudio.com/docs/copilot/chat/chat-modes',
      detectHints: ['ask mode', 'askMode', 'mode:ask'],
      tags: ['core'],
      impact: 'low',
      difficulty: 'low',
      setupSteps: [
        "Open Copilot Chat and select 'Ask' from the mode picker at the top of the chat panel.",
      ],
    },
    {
      id: 'mode-edit',
      name: 'Edit Mode',
      category: 'Modes',
      description:
        'Direct editing mode — Copilot applies changes to your files in-place with a diff review before accepting.',
      docsURL: 'https://code.visualstudio.com/docs/copilot/chat/chat-modes',
      detectHints: ['edit mode', 'editMode', 'mode:edit', 'copilot-edits'],
      tags: ['core'],
      impact: 'medium',
      difficulty: 'low',
      setupSteps: [
        "Open Copilot Chat and select 'Edit' from the mode picker.",
        'Describe the change you want and Copilot will produce a diff.',
      ],
    },
    {
      id: 'mode-agent',
      name: 'Agent Mode',
      category: 'Modes',
      description:
        'Autonomous agent mode — Copilot plans multi-step tasks, runs terminal commands, and edits multiple files.',
      docsURL: 'https://code.visualstudio.com/docs/copilot/chat/chat-modes',
      detectHints: ['agent mode', 'agentMode', 'mode:agent', 'agentic'],
      tags: ['core', 'advanced'],
      impact: 'high',
      difficulty: 'low',
      setupSteps: [
        "Open Copilot Chat and select 'Agent' from the mode picker.",
        'Describe a multi-step task and Copilot will plan and execute it.',
      ],
    },
    // ── Chat ──
    {
      id: 'chat-panel',
      name: 'Chat Panel',
      category: 'Chat',
      description:
        'Dedicated sidebar panel for extended conversations with Copilot.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/chat/copilot-chat',
      detectHints: ['chat panel', 'copilot.chat', 'chat-panel', 'copilot chat', 'ccreq', 'chat request'],
      tags: ['core'],
      impact: 'high',
      difficulty: 'low',
      setupSteps: [
        'Press Ctrl+Shift+I (Cmd+Shift+I on Mac) or click the Copilot icon in the sidebar.',
      ],
    },
    {
      id: 'chat-inline',
      name: 'Inline Chat',
      category: 'Chat',
      description:
        'Trigger Copilot chat directly in the editor at your cursor position for contextual help.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_inline-chat',
      detectHints: ['inline chat', 'inlineChat'],
      tags: ['core'],
      impact: 'low',
      difficulty: 'low',
      setupSteps: [
        'Place your cursor in the editor and press Ctrl+I (Cmd+I on Mac).',
      ],
    },
    {
      id: 'chat-quick',
      name: 'Quick Chat',
      category: 'Chat',
      description:
        'Lightweight floating chat window for fast one-off questions.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_quick-chat',
      detectHints: ['quick chat', 'quickChat'],
      tags: ['core'],
      impact: 'low',
      difficulty: 'low',
      setupSteps: [
        'Press Ctrl+Shift+Alt+L (Cmd+Shift+Alt+L on Mac) to open Quick Chat.',
      ],
    },
    {
      id: 'setting-model-selection',
      name: 'Model Selection',
      category: 'Chat',
      description:
        'Choose which AI model Copilot uses for suggestions and chat responses.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/copilot-settings',
      detectHints: [
        'github.copilot-chat.models',
        'model selection',
        'modelSelection',
      ],
      tags: ['advanced'],
      impact: 'high',
      difficulty: 'low',
      setupSteps: [
        'Click the model name in the Copilot Chat panel header to switch models.',
      ],
    },
    {
      id: 'chat-participant-workspace',
      name: '@workspace Participant',
      category: 'Chat',
      description:
        "Chat participant that scopes Copilot's context to your entire workspace for project-wide questions.",
      docsURL:
        'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-participants',
      detectHints: ['@workspace'],
      tags: ['core', 'context'],
      impact: 'medium',
      difficulty: 'low',
      setupSteps: [
        'Type @workspace in the chat panel followed by your question.',
      ],
    },
    {
      id: 'chat-participant-terminal',
      name: '@terminal Participant',
      category: 'Chat',
      description:
        'Chat participant specialized for terminal and shell command assistance.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-participants',
      detectHints: ['@terminal'],
      tags: ['core'],
      impact: 'medium',
      difficulty: 'low',
      setupSteps: [
        'Type @terminal in the chat panel to get help with shell commands.',
      ],
    },
    {
      id: 'chat-participant-vscode',
      name: '@vscode Participant',
      category: 'Chat',
      description:
        'Chat participant for VS Code settings, keybindings, and editor configuration questions.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-participants',
      detectHints: ['@vscode'],
      tags: ['core'],
      impact: 'low',
      difficulty: 'low',
      setupSteps: [
        'Type @vscode in the chat panel to ask about editor configuration.',
      ],
    },
    // ── Completion ──
    {
      id: 'completion-inline',
      name: 'Inline Suggestions',
      category: 'Completion',
      description:
        'Ghost-text code suggestions that appear as you type, accepted with Tab.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/ai-powered-suggestions',
      detectHints: [
        'inlineSuggest',
        'completionAccepted',
        'completionSuggested',
        'completion',
      ],
      tags: ['core'],
      impact: 'low',
      difficulty: 'low',
      setupSteps: [
        'Enabled by default. Start typing and suggestions appear as ghost text.',
        'Press Tab to accept or Esc to dismiss.',
      ],
    },
    {
      id: 'completion-nes',
      name: 'Next Edit Suggestions (NES)',
      category: 'Completion',
      description:
        'Copilot predicts your next likely edit location and suggests changes proactively.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/ai-powered-suggestions#_next-edit-suggestions',
      detectHints: ['next edit', 'nextEdit', 'github.copilot.nexteditsuggestions'],
      tags: ['advanced', 'new'],
      impact: 'low',
      difficulty: 'low',
      setupSteps: [
        'Enable in settings: github.copilot.nextEditSuggestions.enabled = true',
        "Copilot will highlight the next location it thinks you'll edit.",
      ],
    },
    {
      id: 'completion-multiline',
      name: 'Multi-line Completions',
      category: 'Completion',
      description:
        'Copilot generates multi-line code blocks including entire functions or control structures.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/ai-powered-suggestions',
      detectHints: ['multi-line', 'multiline', 'completion', 'inlineSuggest'],
      tags: ['core'],
      impact: 'low',
      difficulty: 'low',
      setupSteps: [
        'Write a comment or function signature, then pause — Copilot will suggest a multi-line completion.',
      ],
    },
    // ── Customization ──
    {
      id: 'custom-instructions-file',
      name: 'Custom Instructions File',
      category: 'Customization',
      description:
        'A .github/copilot-instructions.md file that gives Copilot project-specific context and coding guidelines.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/copilot-customization#_custom-instructions',
      detectHints: ['copilot-instructions.md'],
      tags: ['advanced'],
      impact: 'high',
      difficulty: 'medium',
      setupSteps: [
        'Create .github/copilot-instructions.md in your repo root.',
        'Add project conventions, preferred patterns, and coding guidelines.',
        'Copilot will automatically include these instructions in every interaction.',
      ],
    },
    {
      id: 'custom-copilotignore',
      name: '.copilotignore File',
      category: 'Customization',
      description:
        "Exclude specific files or directories from Copilot's context and suggestions.",
      docsURL:
        'https://code.visualstudio.com/docs/copilot/copilot-customization',
      detectHints: ['.copilotignore'],
      tags: ['advanced', 'enterprise'],
      impact: 'medium',
      difficulty: 'medium',
      setupSteps: [
        'Create a .copilotignore file in your repo root.',
        'Use .gitignore syntax to list files/patterns to exclude.',
      ],
    },
    {
      id: 'custom-language-enable',
      name: 'Language-Specific Enablement',
      category: 'Customization',
      description:
        'Enable or disable Copilot for specific programming languages via settings.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/copilot-customization',
      detectHints: ['github.copilot.enable', 'copilot.enable'],
      tags: ['core'],
      impact: 'medium',
      difficulty: 'low',
      setupSteps: [
        'Open VS Code settings and search for github.copilot.enable.',
        'Set per-language overrides, e.g. "python": true, "markdown": false.',
      ],
    },
    {
      id: 'custom-mode-instructions',
      name: 'Per-Mode Custom Instructions',
      category: 'Customization',
      description:
        'Provide separate custom instructions for Ask, Edit, and Agent modes to tailor behavior per workflow.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/copilot-customization#_custom-instructions',
      detectHints: ['modeinstructions', 'mode instructions', 'github.copilot.chat.modeinstructions', 'github.copilot-chat.modeinstructions'],
      tags: ['advanced', 'new'],
      impact: 'medium',
      difficulty: 'medium',
      setupSteps: [
        'In VS Code settings, configure github.copilot.chat.modeInstructions for each mode.',
        'Or create mode-specific instruction files in .github/instructions/.',
      ],
    },
    {
      id: 'custom-prompt-files',
      name: 'Reusable Prompt Files',
      category: 'Customization',
      description:
        'Create .prompt.md files to define reusable, shareable prompt templates for common tasks.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/copilot-customization#_reusable-prompts',
      detectHints: ['.prompt.md'],
      tags: ['advanced', 'new'],
      impact: 'high',
      difficulty: 'medium',
      setupSteps: [
        'Create a .github/prompts/ directory in your repo.',
        'Add .prompt.md files with front-matter (mode, tools) and prompt body.',
        'Reference them from chat with / commands.',
      ],
    },
    {
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
    },
    {
      id: 'custom-agents',
      name: 'Custom Agents (Chat Modes)',
      category: 'Customization',
      description:
        'Create custom agent configurations with tailored instructions, tools, and behaviors for specialized workflows like reviewing, testing, or deploying.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/copilot-customization#_reusable-prompts',
      detectHints: [
        'custom agent',
        'customAgent',
        '.prompt.md',
      ],
      tags: ['advanced', 'new'],
      impact: 'high',
      difficulty: 'high',
      setupSteps: [
        'Create a .prompt.md file in .github/prompts/ with a mode and tools front-matter.',
        "Define the agent's persona, constraints, and available tools in the prompt body.",
        'Invoke the custom agent from chat using the / command matching the file name.',
        'Example: .github/prompts/reviewer.prompt.md becomes /reviewer in chat.',
      ],
    },
    // ── Context ──
    {
      id: 'context-file',
      name: '#file Variable',
      category: 'Context',
      description:
        'Reference a specific file in chat to give Copilot targeted context.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
      detectHints: ['#file'],
      tags: ['core'],
      impact: 'medium',
      difficulty: 'low',
      setupSteps: [
        'Type #file: in the chat panel and select a file from the picker.',
      ],
    },
    {
      id: 'context-selection',
      name: '#selection Variable',
      category: 'Context',
      description:
        'Reference the currently selected code in chat for focused assistance.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
      detectHints: ['#selection'],
      tags: ['core'],
      impact: 'medium',
      difficulty: 'low',
      setupSteps: [
        'Select code in the editor, then type #selection in chat to reference it.',
      ],
    },
    {
      id: 'context-codebase',
      name: '#codebase Variable',
      category: 'Context',
      description:
        'Let Copilot search your entire codebase to find relevant context for your question.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
      detectHints: ['#codebase'],
      tags: ['advanced'],
      impact: 'medium',
      difficulty: 'low',
      setupSteps: [
        'Type #codebase in the chat panel — Copilot will search the full project for relevant code.',
      ],
    },
    {
      id: 'context-problems',
      name: '#problems Variable',
      category: 'Context',
      description:
        'Reference current errors and warnings from the Problems panel in chat.',
      docsURL:
        'https://code.visualstudio.com/docs/copilot/chat/copilot-chat#_chat-variables',
      detectHints: ['#problems'],
      tags: ['core'],
      impact: 'medium',
      difficulty: 'low',
      setupSteps: [
        'Type #problems in chat to include current workspace diagnostics in the conversation.',
      ],
    },
    // ── Skills & Tools ──
    {
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
    },
  ];
}

/** Returns the set of feature IDs the user has hidden via settings. Uses vscode API when available. */
export function getHiddenFeatureIDs(): Set<string> {
  try {
    // Dynamic import to avoid breaking non-vscode test environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('copilotEnabler');
    const hidden: string[] = config.get('hiddenFeatures', []);
    return new Set(hidden);
  } catch {
    return new Set();
  }
}

/** Returns the catalog filtered to only visible (non-hidden) features. */
export function visibleCatalog(): Feature[] {
  const hidden = getHiddenFeatureIDs();
  if (hidden.size === 0) { return catalog(); }
  return catalog().filter((f) => !hidden.has(f.id));
}
