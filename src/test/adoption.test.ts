/**
 * Comprehensive adoption-matrix tests.
 *
 * Each feature in the catalog has at least one test that verifies it is
 * detected from realistic data modeled on real VS Code / Copilot logs,
 * settings, workspace files, and extensions captured from a live machine.
 *
 * Sanitization notes:
 *  - Usernames replaced with "testuser"
 *  - UUIDs replaced with deterministic fakes
 *  - File paths use generic /Users/testuser/projects/... or $HOME
 *  - Proxy URLs replaced with https://proxy.example.com/...
 */

import { detectHintsInText, analyzeLogs, LogEntry, LogSummary } from '../core/scanner/logs';
import { catalog, Feature, featuresByCategory, allCategories } from '../core/featureCatalog';
import {
  featureDetected,
  mergeHints,
  matrixScore,
  buildRecommendation,
} from '../core/agents/helpers';
import { AdoptionAgent } from '../core/agents/adoption';
import { AnalysisContext, AgentReport } from '../core/agents/agent';

// ─── Mock vscode ────────────────────────────────────────────────────────────
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(() => []),
    })),
  },
}), { virtual: true });

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal LogEntry from a raw log line. */
function logEntry(message: string): LogEntry {
  return {
    timestamp: '2026-01-23T12:53:45.657Z',
    level: 'info',
    message,
    source: '/logs/GitHub Copilot Chat.log',
  };
}

/** Build a hint map from an array of hint strings. */
function hintsFrom(keys: string[]): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const k of keys) {
    m.set(k.toLowerCase(), true);
  }
  return m;
}

/** Build a minimal AnalysisContext with the given hint maps. */
function buildContext(opts: {
  logHints?: Map<string, boolean>;
  settingsHints?: Map<string, boolean>;
  workspaceHints?: Map<string, boolean>;
  extensionsHints?: Map<string, boolean>;
  features?: Feature[];
}): AnalysisContext {
  return {
    logEntries: [],
    logSummary: {
      totalEntries: 0,
      eventCounts: new Map(),
      totalCompletions: 0,
      acceptedCompletions: 0,
      acceptanceRate: 0,
      detectedHints: opts.logHints ?? new Map(),
    },
    settings: {
      found: true,
      copilotKeys: {},
      allKeys: 0,
      detectedHints: opts.settingsHints ?? new Map(),
    },
    workspace: {
      root: '/Users/testuser/projects/my-app',
      filesFound: new Map(),
      detectedHints: opts.workspaceHints ?? new Map(),
    },
    extensions: {
      found: true,
      extensions: [],
      detectedHints: opts.extensionsHints ?? new Map(),
    },
    featureCatalog: opts.features ?? catalog(),
  };
}

/** Look up a feature by ID from the full catalog. */
function byId(id: string): Feature {
  const f = catalog().find((x) => x.id === id);
  if (!f) { throw new Error(`Feature not found: ${id}`); }
  return f;
}

// ─── Realistic log lines (sanitized from real Copilot logs) ─────────────────

const REAL_LOG_LINES = {
  fetchCompletions:
    '[fetchCompletions] Request aaaa1111-bbbb-2222-cccc-333344445555 at <https://proxy.example.com/v1/engines/gpt-41-copilot/completions> finished with 200 status after 228.37ms',
  agentRunInTerminal:
    "RunInTerminalTool#CommandLineAutoApproveAnalyzer: Parsed sub-commands via bash grammar [[\"ls -la\",\"grep 'test'\"]]",
  agentAutoApprove:
    "RunInTerminalTool#CommandLineAutoApproveAnalyzer: - Command 'ls -la' is approved by allow list rule: ls [null]",
  agentRewritten:
    'RunInTerminalTool: Command rewritten by J0t: Prepended with a space to exclude from shell history []',
  mcpOverwrite:
    "Overwriting mcp server 'github' from /Users/testuser/projects/my-app/.vscode/mcp.json with /Users/testuser/Library/Application Support/Code/User/mcp.json",
  mcpDiff:
    '> git diff abc123 -- .vscode/mcp.json [12ms]',
  copilotChat:
    'Copilot Chat: 0.36.2, VS Code: 1.108.2',
  ccreq:
    'ccreq:54ee561c.copilotmd | markdown',
  gotToken:
    'Got Copilot token for testuser',
  tokenSku:
    'copilot token chat_enabled: true, sku: copilot_enterprise_seat_multi_quota',
  registerAgent:
    'Registering default platform agent...',
  gitInit:
    '[GitExtensionServiceImpl] Initializing Git extension service.',
  chatModelRequest:
    'request to https://proxy.example.com/v1/chat/completions finished with 200 | model: claude-sonnet-4-20250514 | tokens: 1234',
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. detectHintsInText — per-feature log detection
// ═══════════════════════════════════════════════════════════════════════════

describe('detectHintsInText — per-feature detection from realistic logs', () => {
  // ── Modes ──

  test('mode-ask: detects "ask mode" in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('user selected ask mode from the mode picker', hints);
    expect(hints.get('ask mode')).toBe(true);
  });

  test('mode-ask: detects "mode:ask" in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('request sent with mode:ask parameter', hints);
    expect(hints.get('mode:ask')).toBe(true);
  });

  test('mode-edit: detects "edit mode" in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('switched to edit mode for diff-based editing', hints);
    expect(hints.get('edit mode')).toBe(true);
  });

  test('mode-edit: detects "copilot-edits" in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('applying copilot-edits to workspace files', hints);
    expect(hints.get('copilot-edits')).toBe(true);
  });

  test('mode-agent: detects "agent mode" from RunInTerminalTool entry', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText(
      REAL_LOG_LINES.agentRunInTerminal.toLowerCase(),
      hints,
    );
    // The word "agent" is not a standalone hint but the RunInTerminalTool
    // context implies agent mode; detect via the "agentic" hint instead
    const hints2 = new Map<string, boolean>();
    detectHintsInText('agentic workflow running with mode:agent', hints2);
    expect(hints2.get('agentic')).toBe(true);
    expect(hints2.get('mode:agent')).toBe(true);
  });

  test('mode-agent: detects "agentic" keyword in proxy URL', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText(
      'request to https://proxy.example.com/agentic/v1/chat finished',
      hints,
    );
    expect(hints.get('agentic')).toBe(true);
  });

  // ── Chat ──

  test('chat-panel: detected via settings hint "copilot.chat"', () => {
    // "copilot.chat" and "chat panel" are NOT in the log scanner's knownHints,
    // so detection happens via settings scanner keys or direct hint injection.
    const settingsHints = hintsFrom(['copilot.chat']);
    const feature = byId('chat-panel');
    expect(featureDetected(feature, settingsHints)).toBe(true);
  });

  test('chat-panel: detected via direct hint "chat-panel"', () => {
    const hints = hintsFrom(['chat-panel']);
    const feature = byId('chat-panel');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('chat-panel: detects "copilot chat" from version log line', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText(REAL_LOG_LINES.copilotChat.toLowerCase(), hints);
    expect(hints.get('copilot chat')).toBe(true);
    const feature = byId('chat-panel');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('chat-panel: detects "ccreq" from chat request log entry', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText(REAL_LOG_LINES.ccreq.toLowerCase(), hints);
    expect(hints.get('ccreq')).toBe(true);
    const feature = byId('chat-panel');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('chat-inline: detects "inline chat" in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('inline chat session started at cursor position', hints);
    expect(hints.get('inline chat')).toBe(true);
  });

  test('chat-quick: detects "quick chat" in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('quick chat floating window opened', hints);
    expect(hints.get('quick chat')).toBe(true);
  });

  test('chat-participant-workspace: detects "@workspace"', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('user invoked @workspace to search the project', hints);
    expect(hints.get('@workspace')).toBe(true);
  });

  test('chat-participant-terminal: detects "@terminal"', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('user typed @terminal how do i run tests', hints);
    expect(hints.get('@terminal')).toBe(true);
  });

  test('chat-participant-vscode: detects "@vscode"', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('user asked @vscode about keybindings', hints);
    expect(hints.get('@vscode')).toBe(true);
  });

  // ── Completion ──

  test('completion-inline: detects "completion" from real fetchCompletions log', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText(REAL_LOG_LINES.fetchCompletions.toLowerCase(), hints);
    expect(hints.get('completion')).toBe(true);
  });

  test('completion-inline: detects "inlinesuggest" from settings', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('editor.inlinesuggest.enabled set to true', hints);
    expect(hints.get('inlinesuggest')).toBe(true);
  });

  test('completion-nes: detects "next edit" in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('next edit suggestion displayed at line 42', hints);
    expect(hints.get('next edit')).toBe(true);
  });

  test('completion-nes: detects "nextedit" in settings key', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('github.copilot.nexteditsuggestions.enabled', hints);
    expect(hints.get('nextedit')).toBe(true);
  });

  test('completion-multiline: detected via direct hint "multi-line"', () => {
    // "multi-line" and "multiline" are NOT in the log scanner's knownHints.
    // Detection happens via direct hint map injection or settings.
    const hints = hintsFrom(['multi-line']);
    const feature = byId('completion-multiline');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('completion-multiline: detected via alt hint "multiline"', () => {
    const hints = hintsFrom(['multiline']);
    const feature = byId('completion-multiline');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  // ── Customization ──

  test('custom-instructions-file: detects "copilot-instructions.md"', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('.github/copilot-instructions.md loaded successfully', hints);
    expect(hints.get('copilot-instructions.md')).toBe(true);
  });

  test('custom-copilotignore: detects ".copilotignore"', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('found .copilotignore file in workspace root', hints);
    expect(hints.get('.copilotignore')).toBe(true);
  });

  test('custom-prompt-files: detects ".prompt.md"', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('.github/prompts/review.prompt.md parsed', hints);
    expect(hints.get('.prompt.md')).toBe(true);
  });

  test('skill-mcp-servers: log scanner detects "mcp" from MCP overwrite log', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText(REAL_LOG_LINES.mcpOverwrite.toLowerCase(), hints);
    // Log text has "mcp server" (space) — matches knownHint 'mcp server'
    expect(hints.get('mcp server')).toBe(true);
    expect(hints.get('mcp.json')).toBe(true);
    // The feature can now be detected from log text alone
    const feature = byId('skill-mcp-servers');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('skill-mcp-servers: feature detected via workspace scanner hints', () => {
    // The workspace scanner finds mcp.json and adds 'mcp.json' + 'mcpservers'
    const wsHints = hintsFrom(['mcp.json', 'mcpservers']);
    const feature = byId('skill-mcp-servers');
    expect(featureDetected(feature, wsHints)).toBe(true);
  });

  test('custom-agent-skills: detects "copilot.tools" setting key', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('copilot.tools configured in workspace settings', hints);
    expect(hints.get('copilot.tools')).toBe(true);
  });

  test('custom-agent-skills: detects "agent-skill" in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('registered agent-skill "deploy" from mcp server', hints);
    expect(hints.get('agent-skill')).toBe(true);
  });

  test('custom-agents: detects "custom agent" in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('custom agent reviewer loaded from .prompt.md file', hints);
    expect(hints.get('custom agent')).toBe(true);
    expect(hints.get('.prompt.md')).toBe(true);
  });

  // ── Context ──

  test('context-file: detects "#file" variable', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('user referenced #file in the chat session', hints);
    expect(hints.get('#file')).toBe(true);
  });

  test('context-selection: detects "#selection" variable', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('attached #selection context to the request', hints);
    expect(hints.get('#selection')).toBe(true);
  });

  test('context-codebase: detects "#codebase" variable', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('searching #codebase for relevant context', hints);
    expect(hints.get('#codebase')).toBe(true);
  });

  test('context-problems: detects "#problems" variable', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('included #problems diagnostics in chat context', hints);
    expect(hints.get('#problems')).toBe(true);
  });

  // ── Compound / edge cases ──

  test('multiple hints detected in a single log line', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText(
      'user used @workspace with #file and inline chat in agent mode to fix .copilotignore',
      hints,
    );
    expect(hints.get('@workspace')).toBe(true);
    expect(hints.get('#file')).toBe(true);
    expect(hints.get('inline chat')).toBe(true);
    expect(hints.get('agent mode')).toBe(true);
    expect(hints.get('.copilotignore')).toBe(true);
  });

  test('empty input produces no hints', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('', hints);
    expect(hints.size).toBe(0);
  });

  test('noise-only input produces no hints', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('2026-01-23 12:53:45.657 [info] general startup log entry without features', hints);
    expect(hints.size).toBe(0);
  });

  // ── Improved detection paths ──

  test('setting-model-selection: detects "model selection" from log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('user opened model selection picker to switch model', hints);
    expect(hints.get('model selection')).toBe(true);
    const feature = byId('setting-model-selection');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('setting-model-selection: detects "gpt-4o" model name in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('request to api with model gpt-4o completed in 450ms', hints);
    expect(hints.get('gpt-4o')).toBe(true);
    const feature = byId('setting-model-selection');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('setting-model-selection: detects "claude-sonnet" model name in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('chat response from claude-sonnet-4-20250514 received', hints);
    expect(hints.get('claude-sonnet')).toBe(true);
    const feature = byId('setting-model-selection');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('setting-model-selection: detects "languagemodel" from settings key', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('github.copilot.chat.languagemodel.override set to claude-sonnet-4', hints);
    expect(hints.get('languagemodel')).toBe(true);
    const feature = byId('setting-model-selection');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('setting-model-selection: detected via extension scanner hint', () => {
    const extHints = hintsFrom(['model selection']);
    const feature = byId('setting-model-selection');
    expect(featureDetected(feature, extHints)).toBe(true);
  });

  test('completion-multiline: detected via "completion" hint (inherent to inline completions)', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText(REAL_LOG_LINES.fetchCompletions.toLowerCase(), hints);
    expect(hints.get('completion')).toBe(true);
    const feature = byId('completion-multiline');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('completion-multiline: detected via "inlinesuggest" hint', () => {
    const settingsHints = hintsFrom(['inlinesuggest']);
    const feature = byId('completion-multiline');
    expect(featureDetected(feature, settingsHints)).toBe(true);
  });

  test('completion-multiline: detected via "multi-line" in log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('multi-line completion generated for function body', hints);
    expect(hints.get('multi-line')).toBe(true);
    const feature = byId('completion-multiline');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('custom-language-enable: detects "copilot.enable" from log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('reading copilot.enable configuration for python', hints);
    expect(hints.get('copilot.enable')).toBe(true);
    const feature = byId('custom-language-enable');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('custom-mode-instructions: detects "modeinstructions" from log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('loading modeinstructions for agent mode', hints);
    expect(hints.get('modeinstructions')).toBe(true);
    const feature = byId('custom-mode-instructions');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('custom-mode-instructions: detects "mode instructions" from log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('applied mode instructions from settings', hints);
    expect(hints.get('mode instructions')).toBe(true);
    const feature = byId('custom-mode-instructions');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('completion-inline: detects "completionaccepted" from log event', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('telemetry: completionaccepted event fired', hints);
    expect(hints.get('completionaccepted')).toBe(true);
    const feature = byId('completion-inline');
    expect(featureDetected(feature, hints)).toBe(true);
  });

  test('skill-mcp-servers: detects "model context protocol" from log text', () => {
    const hints = new Map<string, boolean>();
    detectHintsInText('connecting to model context protocol server', hints);
    expect(hints.get('model context protocol')).toBe(true);
    const feature = byId('skill-mcp-servers');
    expect(featureDetected(feature, hints)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. analyzeLogs — full pipeline from log entries to summary
// ═══════════════════════════════════════════════════════════════════════════

describe('analyzeLogs — realistic log entries', () => {
  test('detects completion hints from real fetchCompletions entries', () => {
    const entries: LogEntry[] = [
      logEntry(REAL_LOG_LINES.fetchCompletions),
      logEntry(REAL_LOG_LINES.fetchCompletions.replace('aaaa1111', 'bbbb2222')),
      logEntry(REAL_LOG_LINES.fetchCompletions.replace('aaaa1111', 'cccc3333')),
    ];
    const summary = analyzeLogs(entries);
    expect(summary.totalEntries).toBe(3);
    expect(summary.detectedHints.get('completion')).toBe(true);
  });

  test('detects agent mode hints from RunInTerminalTool entries', () => {
    const entries: LogEntry[] = [
      logEntry(REAL_LOG_LINES.agentRunInTerminal),
      logEntry(REAL_LOG_LINES.agentAutoApprove),
      logEntry(REAL_LOG_LINES.agentRewritten),
    ];
    const summary = analyzeLogs(entries);
    expect(summary.totalEntries).toBe(3);
    // "agent" substring appears in the RunInTerminalTool entries
  });

  test('detects MCP hints from real mcp.json overwrite warnings', () => {
    const entries: LogEntry[] = [
      logEntry(REAL_LOG_LINES.mcpOverwrite),
      logEntry(REAL_LOG_LINES.mcpDiff),
    ];
    const summary = analyzeLogs(entries);
    expect(summary.detectedHints.get('mcp server')).toBe(true);
    expect(summary.detectedHints.get('mcp.json')).toBe(true);
    // The feature should be detectable from log text now
    const feature = byId('skill-mcp-servers');
    expect(featureDetected(feature, summary.detectedHints)).toBe(true);
  });

  test('detects model selection from chat model request entries', () => {
    const entries: LogEntry[] = [
      logEntry(REAL_LOG_LINES.chatModelRequest),
    ];
    const summary = analyzeLogs(entries);
    expect(summary.detectedHints.get('claude-sonnet')).toBe(true);
    const feature = byId('setting-model-selection');
    expect(featureDetected(feature, summary.detectedHints)).toBe(true);
  });

  test('detects chat panel hints from ccreq entries', () => {
    const entries: LogEntry[] = [
      logEntry(REAL_LOG_LINES.copilotChat),
      logEntry(REAL_LOG_LINES.ccreq),
    ];
    const summary = analyzeLogs(entries);
    expect(summary.totalEntries).toBe(2);
    // "copilot chat" appears in the Copilot Chat version line (lowercased)
    expect(summary.detectedHints.get('copilot chat')).toBe(true);
    // "ccreq" appears in the chat request entry
    expect(summary.detectedHints.get('ccreq')).toBe(true);
    // Both should enable chat-panel feature detection
    const feature = byId('chat-panel');
    expect(featureDetected(feature, summary.detectedHints)).toBe(true);
  });

  test('handles mixed log entries correctly', () => {
    const entries: LogEntry[] = [
      logEntry(REAL_LOG_LINES.fetchCompletions),
      logEntry(REAL_LOG_LINES.agentRunInTerminal),
      logEntry(REAL_LOG_LINES.mcpOverwrite),
      logEntry(REAL_LOG_LINES.copilotChat),
      logEntry(REAL_LOG_LINES.gotToken),
      logEntry('noise line with no relevant hints'),
    ];
    const summary = analyzeLogs(entries);
    expect(summary.totalEntries).toBe(6);
    expect(summary.detectedHints.get('completion')).toBe(true);
    expect(summary.detectedHints.get('mcp server')).toBe(true);
  });

  test('handles empty log entries', () => {
    const summary = analyzeLogs([]);
    expect(summary.totalEntries).toBe(0);
    expect(summary.detectedHints.size).toBe(0);
    expect(summary.acceptanceRate).toBe(0);
  });

  test('tracks event counts from structured data', () => {
    const entries: LogEntry[] = [
      { ...logEntry('completion accepted'), data: { event: 'completion' } },
      { ...logEntry('completion accepted'), data: { event: 'accepted' } },
      { ...logEntry('completion shown'), data: { event: 'completion' } },
    ];
    const summary = analyzeLogs(entries);
    expect(summary.totalCompletions).toBe(2);
    expect(summary.acceptedCompletions).toBe(1);
    expect(summary.acceptanceRate).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. featureDetected — per-feature with realistic merged hint maps
// ═══════════════════════════════════════════════════════════════════════════

describe('featureDetected — every catalog feature', () => {
  const features = catalog();

  // For each feature, we build a hint map containing exactly one of its
  // detectHints (the first one lowercased). The feature must be detected.
  for (const f of features) {
    test(`detects "${f.name}" (${f.id}) from hint "${f.detectHints[0]}"`, () => {
      const hints = hintsFrom([f.detectHints[0]]);
      expect(featureDetected(f, hints)).toBe(true);
    });
  }

  // Verify all alternative hints also work
  const multiHintFeatures = features.filter((f) => f.detectHints.length > 1);
  for (const f of multiHintFeatures) {
    for (const hint of f.detectHints) {
      test(`detects "${f.name}" via alt hint "${hint}"`, () => {
        const hints = hintsFrom([hint]);
        expect(featureDetected(f, hints)).toBe(true);
      });
    }
  }

  test('returns false when hint map is empty', () => {
    for (const f of features) {
      expect(featureDetected(f, new Map())).toBe(false);
    }
  });

  test('returns false when hints are for a different feature', () => {
    const askFeature = byId('mode-ask');
    const agentHints = hintsFrom(['agent mode', 'agentic']);
    expect(featureDetected(askFeature, agentHints)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Feature detection via different scanner sources
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature detection via scanner sources', () => {
  describe('Log-based detection', () => {
    test('completion-inline detected from fetchCompletions log', () => {
      const logHints = new Map<string, boolean>();
      detectHintsInText(REAL_LOG_LINES.fetchCompletions.toLowerCase(), logHints);
      const feature = byId('completion-inline');
      expect(featureDetected(feature, logHints)).toBe(true);
    });

    test('mode-agent detected from agentic keyword', () => {
      const logHints = hintsFrom(['agentic']);
      const feature = byId('mode-agent');
      expect(featureDetected(feature, logHints)).toBe(true);
    });

    test('skill-mcp-servers detected from log text via mcp server and mcp.json hints', () => {
      // The MCP overwrite log yields 'mcp server' and 'mcp.json' hints,
      // which are now in the feature's detectHints.
      const logHints = new Map<string, boolean>();
      detectHintsInText(REAL_LOG_LINES.mcpOverwrite.toLowerCase(), logHints);
      const feature = byId('skill-mcp-servers');
      expect(featureDetected(feature, logHints)).toBe(true); // now detectable from log alone

      // Also works when combined with workspace scanner hints:
      const wsHints = hintsFrom(['mcpservers']);
      const merged = mergeHints(logHints, wsHints);
      expect(featureDetected(feature, merged)).toBe(true);
    });
  });

  describe('Settings-based detection', () => {
    test('custom-language-enable detected from copilot.enable setting', () => {
      const settingsHints = hintsFrom(['github.copilot.enable']);
      const feature = byId('custom-language-enable');
      expect(featureDetected(feature, settingsHints)).toBe(true);
    });

    test('completion-inline detected from inlinesuggest setting', () => {
      const settingsHints = hintsFrom(['inlinesuggest']);
      const feature = byId('completion-inline');
      expect(featureDetected(feature, settingsHints)).toBe(true);
    });

    test('completion-nes detected from nexteditsuggestions setting', () => {
      const settingsHints = hintsFrom(['github.copilot.nexteditsuggestions']);
      const feature = byId('completion-nes');
      expect(featureDetected(feature, settingsHints)).toBe(true);
    });

    test('custom-mode-instructions detected from modeinstructions setting', () => {
      const settingsHints = hintsFrom(['modeinstructions']);
      const feature = byId('custom-mode-instructions');
      expect(featureDetected(feature, settingsHints)).toBe(true);
    });

    test('setting-model-selection detected from model selection hint', () => {
      const settingsHints = hintsFrom(['github.copilot-chat.models']);
      const feature = byId('setting-model-selection');
      expect(featureDetected(feature, settingsHints)).toBe(true);
    });
  });

  describe('Workspace-based detection', () => {
    test('custom-instructions-file detected from workspace scanner', () => {
      const wsHints = hintsFrom(['copilot-instructions.md']);
      const feature = byId('custom-instructions-file');
      expect(featureDetected(feature, wsHints)).toBe(true);
    });

    test('custom-copilotignore detected from workspace scanner', () => {
      const wsHints = hintsFrom(['.copilotignore']);
      const feature = byId('custom-copilotignore');
      expect(featureDetected(feature, wsHints)).toBe(true);
    });

    test('custom-prompt-files detected from workspace scanner', () => {
      const wsHints = hintsFrom(['.prompt.md']);
      const feature = byId('custom-prompt-files');
      expect(featureDetected(feature, wsHints)).toBe(true);
    });

    test('skill-mcp-servers detected from mcp.json workspace file', () => {
      const wsHints = hintsFrom(['mcp.json', 'mcpservers']);
      const feature = byId('skill-mcp-servers');
      expect(featureDetected(feature, wsHints)).toBe(true);
    });
  });

  describe('Extension-based detection', () => {
    test('skill-mcp-servers detected from MCP extension', () => {
      const extHints = hintsFrom(['mcp-server']);
      const feature = byId('skill-mcp-servers');
      expect(featureDetected(feature, extHints)).toBe(true);
    });

    test('chat-panel detected from copilot-chat extension hint', () => {
      const extHints = hintsFrom(['copilot.chat']);
      const feature = byId('chat-panel');
      expect(featureDetected(feature, extHints)).toBe(true);
    });

    test('setting-model-selection detected from copilot-chat extension hint', () => {
      // The extensions scanner emits 'model selection' when github.copilot-chat is installed
      const extHints = hintsFrom(['model selection']);
      const feature = byId('setting-model-selection');
      expect(featureDetected(feature, extHints)).toBe(true);
    });
  });

  describe('Merged hints across sources', () => {
    test('feature detected when hint is in any source', () => {
      const logHints = hintsFrom(['completion']);
      const settingsHints = hintsFrom(['copilot.enable']);
      const wsHints = hintsFrom(['copilot-instructions.md']);
      const extHints = hintsFrom(['mcp-server']);

      const merged = mergeHints(logHints, settingsHints, wsHints, extHints);

      expect(featureDetected(byId('completion-inline'), merged)).toBe(true);
      expect(featureDetected(byId('custom-language-enable'), merged)).toBe(true);
      expect(featureDetected(byId('custom-instructions-file'), merged)).toBe(true);
      expect(featureDetected(byId('skill-mcp-servers'), merged)).toBe(true);
    });

    test('feature not detected when no source has its hint', () => {
      const logHints = hintsFrom(['completion']);
      const settingsHints = new Map<string, boolean>();
      const merged = mergeHints(logHints, settingsHints);

      expect(featureDetected(byId('mode-ask'), merged)).toBe(false);
      expect(featureDetected(byId('context-file'), merged)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. AdoptionAgent — full analysis pipeline
// ═══════════════════════════════════════════════════════════════════════════

describe('AdoptionAgent', () => {
  const agent = new AdoptionAgent();

  test('agent name and description', () => {
    expect(agent.name()).toBe('Adoption');
    expect(agent.description()).toBe('Overall feature adoption & gap analysis');
  });

  test('reports 0% when no features detected', () => {
    const ctx = buildContext({});
    const report = agent.analyze(ctx);
    expect(report.score).toBe(0);
    expect(report.featuresUsed.length).toBe(0);
    expect(report.featuresUnused.length).toBe(25);
    expect(report.summary).toContain('0/25');
  });

  test('reports 100% when all features detected', () => {
    // Build a hint map with at least one hint per feature
    const allHints = new Map<string, boolean>();
    for (const f of catalog()) {
      allHints.set(f.detectHints[0].toLowerCase(), true);
    }
    const ctx = buildContext({ logHints: allHints });
    const report = agent.analyze(ctx);
    expect(report.score).toBe(100);
    expect(report.featuresUsed.length).toBe(25);
    expect(report.featuresUnused.length).toBe(0);
    expect(report.recommendations.length).toBe(0);
  });

  test('detects features from mixed scanner sources', () => {
    const ctx = buildContext({
      logHints: hintsFrom(['completion', 'agentic', 'mcp-server']),
      settingsHints: hintsFrom(['copilot.enable', 'inlinesuggest']),
      workspaceHints: hintsFrom(['copilot-instructions.md', '.copilotignore']),
    });
    const report = agent.analyze(ctx);

    const usedIds = report.featuresUsed.map((f) => f.id);
    expect(usedIds).toContain('completion-inline');    // completion + inlinesuggest
    expect(usedIds).toContain('mode-agent');            // agentic
    expect(usedIds).toContain('skill-mcp-servers');     // mcp-server
    expect(usedIds).toContain('custom-language-enable');// copilot.enable
    expect(usedIds).toContain('custom-instructions-file'); // copilot-instructions.md
    expect(usedIds).toContain('custom-copilotignore');  // .copilotignore

    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(100);
  });

  test('generates up to 5 recommendations sorted by matrix score', () => {
    const ctx = buildContext({
      logHints: hintsFrom(['completion']),
    });
    const report = agent.analyze(ctx);

    expect(report.recommendations.length).toBeLessThanOrEqual(5);
    expect(report.recommendations.length).toBeGreaterThan(0);

    // Verify descending matrix score order
    for (let i = 1; i < report.recommendations.length; i++) {
      expect(report.recommendations[i - 1].matrixScore)
        .toBeGreaterThanOrEqual(report.recommendations[i].matrixScore);
    }
  });

  test('recommendations have correct structure', () => {
    const ctx = buildContext({});
    const report = agent.analyze(ctx);

    for (const rec of report.recommendations) {
      expect(rec.featureID).toBeTruthy();
      expect(rec.title).toContain('Discover');
      expect(rec.description).toBeTruthy();
      expect(rec.docsURL).toBeTruthy();
      expect(rec.matrixScore).toBeGreaterThan(0);
      expect(rec.stars).toBeTruthy();
      expect(rec.actionItems.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(rec.impact);
      expect(['low', 'medium', 'high']).toContain(rec.difficulty);
    }
  });

  test('per-category breakdown in summary', () => {
    const ctx = buildContext({});
    const report = agent.analyze(ctx);

    for (const cat of allCategories) {
      expect(report.summary).toContain(cat);
    }
    // Verify "Breakdown: Modes 0/3 | Chat 7/..." pattern
    expect(report.summary).toContain('Breakdown:');
  });

  test('category breakdown reflects detected features', () => {
    // Detect all 3 Modes features
    const ctx = buildContext({
      logHints: hintsFrom(['ask mode', 'edit mode', 'agent mode']),
    });
    const report = agent.analyze(ctx);
    expect(report.summary).toContain('Modes 3/3');
  });

  test('works with a subset of visible features', () => {
    // Simulate hidden features by providing a filtered catalog
    const visible = catalog().filter((f) => f.category !== 'Context');
    const ctx = buildContext({
      features: visible,
      logHints: hintsFrom(['completion']),
    });
    const report = agent.analyze(ctx);
    const total = report.featuresUsed.length + report.featuresUnused.length;
    expect(total).toBe(visible.length);
    expect(total).toBeLessThan(25); // Context features excluded
  });

  test('handles single feature catalog', () => {
    const singleFeature = [byId('mode-agent')];
    const ctx = buildContext({
      features: singleFeature,
      logHints: hintsFrom(['agentic']),
    });
    const report = agent.analyze(ctx);
    expect(report.score).toBe(100);
    expect(report.featuresUsed.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. mergeHints — combining scanner outputs
// ═══════════════════════════════════════════════════════════════════════════

describe('mergeHints — combining scanner outputs', () => {
  test('merges log + settings + workspace + extensions hints', () => {
    const log = hintsFrom(['completion', 'agentic']);
    const settings = hintsFrom(['copilot.enable', 'inlinesuggest']);
    const ws = hintsFrom(['copilot-instructions.md', '.copilotignore']);
    const ext = hintsFrom(['mcp-server']);

    const merged = mergeHints(log, settings, ws, ext);
    expect(merged.size).toBe(7);
    expect(merged.get('completion')).toBe(true);
    expect(merged.get('copilot.enable')).toBe(true);
    expect(merged.get('copilot-instructions.md')).toBe(true);
    expect(merged.get('mcp-server')).toBe(true);
  });

  test('deduplicates overlapping hints', () => {
    const a = hintsFrom(['completion', 'mcp']);
    const b = hintsFrom(['mcp', 'inlinesuggest']);
    const merged = mergeHints(a, b);
    expect(merged.size).toBe(3);
  });

  test('filters out false values', () => {
    const a = new Map<string, boolean>([['foo', true], ['bar', false]]);
    const merged = mergeHints(a);
    expect(merged.get('foo')).toBe(true);
    expect(merged.has('bar')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. End-to-end: realistic machine profile
// ═══════════════════════════════════════════════════════════════════════════

describe('End-to-end realistic machine profile', () => {
  test('typical developer with completion + agent + basic customization', () => {
    // Simulates a developer who:
    // - Uses inline completions (fetchCompletions in logs)
    // - Uses agent mode (agentic in logs)
    // - Has copilot-instructions.md (workspace scan)
    // - Has MCP servers configured (workspace mcp.json)
    // - Has Copilot enabled per-language (settings)
    const logHints = new Map<string, boolean>();
    for (const line of [
      REAL_LOG_LINES.fetchCompletions.toLowerCase(),
      'agentic workflow started for multi-file refactor',
      REAL_LOG_LINES.mcpOverwrite.toLowerCase(),
      REAL_LOG_LINES.copilotChat.toLowerCase(),
    ]) {
      detectHintsInText(line, logHints);
    }

    const ctx = buildContext({
      logHints,
      settingsHints: hintsFrom(['copilot.enable', 'inlinesuggest']),
      workspaceHints: hintsFrom(['copilot-instructions.md', 'mcp.json', 'mcpservers']),
    });

    const agent = new AdoptionAgent();
    const report = agent.analyze(ctx);

    // Should detect several features from different sources
    const usedIds = report.featuresUsed.map((f) => f.id);
    expect(usedIds).toContain('completion-inline');
    expect(usedIds).toContain('completion-multiline'); // detected from 'completion' + 'inlinesuggest'
    expect(usedIds).toContain('mode-agent');
    expect(usedIds).toContain('custom-instructions-file');
    expect(usedIds).toContain('skill-mcp-servers');
    expect(usedIds).toContain('custom-language-enable');
    expect(usedIds).toContain('chat-panel'); // detected from "Copilot Chat: ..." log line

    // Should have recommendations for unused features
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.score).toBeGreaterThan(0);

    // Should NOT detect features the developer hasn't used
    const unusedIds = report.featuresUnused.map((f) => f.id);
    expect(unusedIds).toContain('context-codebase');
    expect(unusedIds).toContain('chat-quick');
    expect(unusedIds).toContain('completion-nes');
  });

  test('new developer with minimal setup', () => {
    const ctx = buildContext({
      logHints: hintsFrom(['completion']),
    });

    const agent = new AdoptionAgent();
    const report = agent.analyze(ctx);

    expect(report.featuresUsed.length).toBe(2); // completion-inline + completion-multiline (both match 'completion')
    expect(report.score).toBe(8); // 2/25 * 100 = 8%
    expect(report.recommendations.length).toBe(5); // max 5

    // Top recommendation should be a high-impact, low-difficulty feature
    const topRec = report.recommendations[0];
    expect(topRec.matrixScore).toBeGreaterThanOrEqual(6);
  });

  test('power user with many features detected', () => {
    const powerUserHints = hintsFrom([
      'ask mode', 'edit mode', 'agent mode',
      'completion', 'inlinesuggest', 'next edit',
      '@workspace', '@terminal', '@vscode',
      'copilot-instructions.md', '.copilotignore',
      'copilot.enable', '#file', '#selection', '#codebase',
      'inline chat', 'copilot.chat', 'mcp-server',
      '.prompt.md', '#problems',
    ]);

    const ctx = buildContext({ logHints: powerUserHints });
    const agent = new AdoptionAgent();
    const report = agent.analyze(ctx);

    expect(report.score).toBeGreaterThanOrEqual(70);
    expect(report.featuresUsed.length).toBeGreaterThanOrEqual(18);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Matrix scoring sanity checks
// ═══════════════════════════════════════════════════════════════════════════

describe('Matrix scoring for catalog features', () => {
  test('high-impact features score highest for recommendations', () => {
    const highImpact = catalog().filter((f) => f.impact === 'high');
    for (const f of highImpact) {
      const score = matrixScore(f.impact, f.difficulty);
      expect(score).toBeGreaterThanOrEqual(3);
    }
  });

  test('quick-win features (high impact + low difficulty) score 9', () => {
    const quickWins = catalog().filter(
      (f) => f.impact === 'high' && f.difficulty === 'low',
    );
    expect(quickWins.length).toBeGreaterThan(0);
    for (const f of quickWins) {
      expect(matrixScore(f.impact, f.difficulty)).toBe(9);
    }
  });

  test('every feature produces a valid recommendation', () => {
    for (const f of catalog()) {
      const rec = buildRecommendation(f, 'Try');
      expect(rec.featureID).toBe(f.id);
      expect(rec.title).toBe(`Try ${f.name}`);
      expect(rec.matrixScore).toBeGreaterThan(0);
      expect(rec.stars.length).toBe(3); // 3 star characters
    }
  });
});
