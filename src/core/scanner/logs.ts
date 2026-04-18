// Port of internal/scanner/logs.go — file-based Copilot log scanning.

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { catalog } from '../featureCatalog';

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
  llmRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

/**
 * Build the set of known hints dynamically from the feature catalog.
 * Each feature's detectHints (string or {hint}) are normalised to lowercase.
 * File-path-only hints (object form with path but no keyword) are skipped
 * since those are for the workspace scanner, not log text matching.
 */
function buildKnownHints(): string[] {
  const hints = new Set<string>();
  for (const f of catalog()) {
    for (const h of f.detectHints) {
      if (typeof h === 'string') {
        hints.add(h.toLowerCase());
      } else if (h.hint) {
        hints.add(h.hint.toLowerCase());
      }
    }
  }
  return Array.from(hints);
}

/** Lazily-initialised hint list derived from the feature catalog. */
let _knownHints: string[] | undefined;
function knownHints(): string[] {
  if (!_knownHints) { _knownHints = buildKnownHints(); }
  return _knownHints;
}

/** Reset the cached hints (useful for testing after catalog changes). */
export function resetKnownHints(): void {
  _knownHints = undefined;
}

/** detectHintsInText checks a lowercased text for known feature-usage hints. */
export function detectHintsInText(text: string, hints: Map<string, boolean>): void {
  for (const h of knownHints()) {
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

/** Get paths to all GitHub Copilot Chat debug-logs folders in workspaceStorage. */
export function getWorkspaceStorageDebugLogPaths(): string[] {
  const homeDir = os.homedir();
  let storageBase: string;
  switch (process.platform) {
    case 'win32':
      storageBase = path.join(process.env['APPDATA'] ?? '', 'Code', 'User', 'workspaceStorage');
      break;
    case 'darwin':
      storageBase = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
      break;
    case 'linux':
      storageBase = path.join(homeDir, '.config', 'Code', 'User', 'workspaceStorage');
      break;
    default:
      return [];
  }

  const debugLogPaths: string[] = [];
  try {
    const workspaceFolders = fs.readdirSync(storageBase, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(storageBase, d.name));
    for (const wsFolder of workspaceFolders) {
      const debugLogsPath = path.join(wsFolder, 'GitHub.copilot-chat', 'debug-logs');
      if (fs.existsSync(debugLogsPath)) {
        debugLogPaths.push(debugLogsPath);
      }
    }
  } catch {
    // Skip on access errors
  }
  return debugLogPaths;
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
        // Detect workspaceStorage debug-log format (has numeric ts and string type)
        if (typeof parsed.ts === 'number' && typeof parsed.type === 'string') {
          const attrs = (parsed.attrs ?? {}) as Record<string, unknown>;
          const entry: LogEntry = {
            timestamp: new Date(parsed.ts).toISOString(),
            level: parsed.status === 'error' ? 'error' : 'info',
            message: (parsed.name ?? parsed.type) as string,
            source: filePath,
            data: { type: parsed.type, name: parsed.name, dur: parsed.dur, ...attrs },
          };
          entries.push(entry);
        } else {
          const entry: LogEntry = {
            timestamp: parsed.timestamp ?? new Date().toISOString(),
            level: parsed.level ?? 'info',
            message: parsed.message ?? parsed.msg ?? trimmed,
            source: filePath,
            data: parsed.data ?? parsed,
          };
          entries.push(entry);
        }
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
  const entries: LogEntry[] = [];

  const logPath = getCopilotLogPath();
  if (logPath && fs.existsSync(logPath)) {
    entries.push(...readLogFiles(logPath));
  }

  for (const debugLogPath of getWorkspaceStorageDebugLogPaths()) {
    entries.push(...readLogFiles(debugLogPath));
  }

  return entries;
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
    llmRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
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

    // Aggregate token usage from debug-log llm_request entries
    if (e.data?.type === 'llm_request') {
      s.llmRequests++;
      if (typeof e.data.inputTokens === 'number') {
        s.totalInputTokens += e.data.inputTokens;
      }
      if (typeof e.data.outputTokens === 'number') {
        s.totalOutputTokens += e.data.outputTokens;
      }
    }
  }

  if (s.totalCompletions > 0) {
    s.acceptanceRate = (s.acceptedCompletions / s.totalCompletions) * 100;
  }

  return s;
}
