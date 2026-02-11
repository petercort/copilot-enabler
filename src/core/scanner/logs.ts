// Port of internal/scanner/logs.go — file-based Copilot log scanning.

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/** LogEntry represents a single Copilot log entry. */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
  data?: Record<string, unknown>;
}

/** LogSummary holds aggregated results from log analysis. */
export interface LogSummary {
  totalEntries: number;
  eventCounts: Map<string, number>;
  totalCompletions: number;
  acceptedCompletions: number;
  acceptanceRate: number;
  detectedHints: Map<string, boolean>;
}

/** Known feature-usage hints to scan for in log text. */
const knownHints: string[] = [
  // Modes
  'ask mode', 'askmode', 'mode:ask',
  'edit mode', 'editmode', 'mode:edit', 'copilot-edits',
  'agent mode', 'agentmode', 'mode:agent', 'agentic',
  // Chat
  'copilot chat', 'ccreq', 'chat request', 'chat-panel',
  'inline chat', 'inlinechat',
  'quick chat', 'quickchat',
  'model selection', 'modelselection',
  // Participants & Context
  '@workspace', '@terminal', '@vscode',
  '#file', '#selection', '#codebase', '#problems',
  // Completion
  'completion', 'completionaccepted', 'completionsuggested',
  'inlinesuggest', 'multi-line', 'multiline',
  'next edit', 'nextedit',
  // Customization
  'copilot-instructions.md', '.copilotignore', '.prompt.md',
  'copilot.enable', 'modeinstructions', 'mode instructions',
  'custom agent', 'customagent', 'agent-skill', 'customtool', 'copilot.tools',
  // MCP
  'mcp server', 'mcp.json', 'mcpservers', 'mcp-server', 'model context protocol',
];

/** detectHintsInText checks a lowercased text for known feature-usage hints. */
export function detectHintsInText(text: string, hints: Map<string, boolean>): void {
  for (const h of knownHints) {
    if (text.includes(h)) {
      hints.set(h, true);
    }
  }
}

/** Get the platform-specific Copilot log path. */
function getCopilotLogPath(): string | undefined {
  const homeDir = os.homedir();
  switch (process.platform) {
    case 'win32':
      return path.join(process.env['APPDATA'] ?? '', 'Code', 'logs');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'Code', 'logs');
    case 'linux':
      return path.join(homeDir, '.config', 'Code', 'logs');
    default:
      return undefined;
  }
}

/** Check if a file path is a Copilot log. */
function isCopilotLog(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('copilot') ||
    lower.includes('github.copilot')
  );
}

/** Parse a single log file into entries. */
function parseLogFile(filePath: string): LogEntry[] {
  const entries: LogEntry[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const parsed = JSON.parse(trimmed);
        const entry: LogEntry = {
          timestamp: parsed.timestamp ?? new Date().toISOString(),
          level: parsed.level ?? 'info',
          message: parsed.message ?? parsed.msg ?? trimmed,
          source: filePath,
          data: parsed.data ?? parsed,
        };
        entries.push(entry);
      } catch {
        entries.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: trimmed,
          source: filePath,
        });
      }
    }
  } catch {
    // Skip unreadable files
  }
  return entries;
}

/** Recursively read log files from a directory. */
function readLogFiles(logPath: string): LogEntry[] {
  const entries: LogEntry[] = [];
  try {
    const walk = (dir: string) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          walk(full);
        } else if (isCopilotLog(full)) {
          entries.push(...parseLogFile(full));
        }
      }
    };
    walk(logPath);
  } catch {
    // Directory may not exist
  }
  return entries;
}

/** ScanCopilotLogs scans VS Code Copilot logs and returns parsed entries. */
export function scanCopilotLogs(): LogEntry[] {
  const logPath = getCopilotLogPath();
  if (!logPath) {
    return [];
  }
  if (!fs.existsSync(logPath)) {
    return [];
  }
  return readLogFiles(logPath);
}

/** AnalyzeLogs produces an aggregated summary from raw log entries. */
export function analyzeLogs(entries: LogEntry[]): LogSummary {
  const s: LogSummary = {
    totalEntries: entries.length,
    eventCounts: new Map(),
    totalCompletions: 0,
    acceptedCompletions: 0,
    acceptanceRate: 0,
    detectedHints: new Map(),
  };

  for (const e of entries) {
    if (!e.message) { continue; }
    const lower = e.message.toLowerCase();

    if (e.data?.event && typeof e.data.event === 'string') {
      const eventType = e.data.event;
      s.eventCounts.set(eventType, (s.eventCounts.get(eventType) ?? 0) + 1);
      if (eventType === 'completion') {
        s.totalCompletions++;
      }
      if (eventType === 'accepted') {
        s.acceptedCompletions++;
      }
    }

    detectHintsInText(lower, s.detectedHints);
  }

  if (s.totalCompletions > 0) {
    s.acceptanceRate = (s.acceptedCompletions / s.totalCompletions) * 100;
  }

  return s;
}
