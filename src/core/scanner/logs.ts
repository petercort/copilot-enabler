// Port of internal/scanner/logs.go — file-based Copilot log scanning.

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { catalog } from '../featureCatalog';

/** Skip log files older than this (7 days). */
export const LOG_MTIME_CUTOFF_MS = 7 * 86_400_000;
/** Per-file size cap (2 MB) — larger files are tail-read. */
export const MAX_LOG_BYTES = 2 * 1024 * 1024;
/** Hard cap on total parsed entries per scan. */
export const MAX_ENTRIES = 50_000;
/** Limit how many workspaceStorage debug-log folders we walk (most-recent first). */
export const MAX_WORKSPACE_STORAGE_DIRS = 10;

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
  /** True when any entries came from VS Code's standard log files (not the
   *  debug-output JSONL format). Those files do not carry token data, so
   *  cache-token counts cannot be determined from them. */
  hasVSCodeLogs: boolean;
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

/** Get paths to GitHub Copilot Chat debug-logs folders in workspaceStorage,
 *  capped to the {@link MAX_WORKSPACE_STORAGE_DIRS} most recently modified
 *  workspace folders. */
export async function getWorkspaceStorageDebugLogPaths(): Promise<string[]> {
  const homeDir = os.homedir();
  let storageBase: string;
  switch (process.platform) {
    case 'win32': {
      const appData = process.env['APPDATA'];
      if (!appData) { return []; }
      storageBase = path.join(appData, 'Code', 'User', 'workspaceStorage');
      break;
    }
    case 'darwin':
      storageBase = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
      break;
    case 'linux':
      storageBase = path.join(homeDir, '.config', 'Code', 'User', 'workspaceStorage');
      break;
    default:
      return [];
  }

  try {
    const dirents = await fsp.readdir(storageBase, { withFileTypes: true });
    const candidates: { dir: string; mtimeMs: number }[] = [];
    await Promise.all(
      dirents
        .filter(d => d.isDirectory())
        .map(async d => {
          const dir = path.join(storageBase, d.name);
          try {
            const st = await fsp.stat(dir);
            candidates.push({ dir, mtimeMs: st.mtimeMs });
          } catch {
            // Skip
          }
        }),
    );
    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);

    const debugLogPaths: string[] = [];
    for (const { dir } of candidates.slice(0, MAX_WORKSPACE_STORAGE_DIRS)) {
      const debugLogsPath = path.join(dir, 'GitHub.copilot-chat', 'debug-logs');
      try {
        await fsp.access(debugLogsPath);
        debugLogPaths.push(debugLogsPath);
      } catch {
        // Skip missing
      }
    }
    return debugLogPaths;
  } catch {
    return [];
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

/** Read at most {@link MAX_LOG_BYTES} from `filePath`. For oversized files we
 *  open and read the trailing window so the most recent entries survive,
 *  discarding the first (likely partial) line. */
async function readBoundedFile(filePath: string, size: number): Promise<string> {
  if (size <= MAX_LOG_BYTES) {
    return fsp.readFile(filePath, 'utf-8');
  }
  const fh = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(MAX_LOG_BYTES);
    await fh.read(buf, 0, MAX_LOG_BYTES, size - MAX_LOG_BYTES);
    const text = buf.toString('utf-8');
    const nl = text.indexOf('\n');
    return nl >= 0 ? text.slice(nl + 1) : text;
  } finally {
    await fh.close();
  }
}

/** Parse a single log file into entries. Returns an empty array on errors. */
async function parseLogFile(filePath: string, size: number): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];
  let content: string;
  try {
    content = await readBoundedFile(filePath, size);
  } catch {
    return entries;
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.ts === 'number' && typeof parsed.type === 'string') {
        const attrs = (parsed.attrs ?? {}) as Record<string, unknown>;
        entries.push({
          timestamp: new Date(parsed.ts).toISOString(),
          level: parsed.status === 'error' ? 'error' : 'info',
          message: (parsed.name ?? parsed.type) as string,
          source: filePath,
          data: { type: parsed.type, name: parsed.name, dur: parsed.dur, ...attrs },
        });
      } else {
        entries.push({
          timestamp: parsed.timestamp ?? new Date().toISOString(),
          level: parsed.level ?? 'info',
          message: parsed.message ?? parsed.msg ?? trimmed,
          source: filePath,
          data: parsed.data ?? parsed,
        });
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
  return entries;
}

/** Recursively read log files from a directory, applying mtime/size/count caps.
 *  Walks the tree and pushes entries into `entries`; returns true when the
 *  global {@link MAX_ENTRIES} cap has been hit and walking should stop.
 *  Exported for testing. */
export async function readLogFiles(logPath: string, entries: LogEntry[]): Promise<boolean> {
  const cutoff = Date.now() - LOG_MTIME_CUTOFF_MS;

  const walk = async (dir: string): Promise<boolean> => {
    let items: fs.Dirent[];
    try {
      items = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const item of items) {
      if (entries.length >= MAX_ENTRIES) { return true; }
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        const stop = await walk(full);
        if (stop) { return true; }
        continue;
      }
      if (!isCopilotLog(full)) { continue; }
      let st: fs.Stats;
      try {
        st = await fsp.stat(full);
      } catch {
        continue;
      }
      if (st.mtimeMs < cutoff) { continue; }
      const parsed = await parseLogFile(full, st.size);
      for (const e of parsed) {
        if (entries.length >= MAX_ENTRIES) { return true; }
        entries.push(e);
      }
    }
    return false;
  };

  return walk(logPath);
}

/** ScanCopilotLogs scans VS Code Copilot logs and returns parsed entries.
 *  Bounded by mtime, per-file size, and total entry caps so activation does
 *  not block on tens of MB of historical logs. */
export async function scanCopilotLogs(): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];

  const logPath = getCopilotLogPath();
  if (logPath) {
    try {
      await fsp.access(logPath);
      const stop = await readLogFiles(logPath, entries);
      if (stop) { return entries; }
    } catch {
      // Path missing — skip
    }
  }

  for (const debugLogPath of await getWorkspaceStorageDebugLogPaths()) {
    if (entries.length >= MAX_ENTRIES) { break; }
    const stop = await readLogFiles(debugLogPath, entries);
    if (stop) { break; }
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
    hasVSCodeLogs: false,
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

    // Mark if this entry came from VS Code's standard log files (no token data)
    if (e.source && !e.source.includes('workspaceStorage')) {
      s.hasVSCodeLogs = true;
    }

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
