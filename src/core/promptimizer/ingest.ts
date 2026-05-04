// Ingest adapters: Copilot Chat logs, JSONL dumps, and .har captures.
//
// Pure Node-only: no `vscode` imports. The Copilot Chat path reuses the log
// directory discovery from `src/core/scanner/logs.ts` via `getLogRoots()`.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Block, ContextWindowSnapshot, IngestedSession, ModelMetrics, RawTurn } from './types';

/** Cross-platform VS Code log root used by the existing scanner. */
function getLogRoots(): string[] {
  const homeDir = os.homedir();
  const roots: string[] = [];
  switch (process.platform) {
    case 'win32':
      roots.push(path.join(process.env['APPDATA'] ?? '', 'Code', 'logs'));
      break;
    case 'darwin':
      roots.push(path.join(homeDir, 'Library', 'Application Support', 'Code', 'logs'));
      break;
    case 'linux':
      roots.push(path.join(homeDir, '.config', 'Code', 'logs'));
      break;
  }
  return roots.filter(Boolean);
}

/** Return true when a path under a VS Code log tree belongs to Copilot Chat. */
function isCopilotChatLog(full: string): boolean {
  const lower = full.toLowerCase();
  return (
    lower.endsWith('.log') || lower.endsWith('.jsonl') || lower.endsWith('.json')
  ) && (
    lower.includes('copilot-chat') ||
    lower.includes('copilotchat') ||
    lower.includes('github.copilot-chat') ||
    lower.includes('copilot')
  );
}

function walk(dir: string, out: string[]): void {
  let items: fs.Dirent[];
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      walk(full, out);
    } else if (isCopilotChatLog(full)) {
      out.push(full);
    }
  }
}

/** Discover Copilot Chat log files on this workstation. */
export function discoverCopilotChatLogFiles(): string[] {
  const out: string[] = [];
  for (const root of getLogRoots()) {
    if (!fs.existsSync(root)) { continue; }
    walk(root, out);
  }
  return out;
}

// --- shared block extraction ---------------------------------------------

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function blockFromAnthropicMessage(
  turnIndex: number,
  role: 'user' | 'assistant',
  content: unknown,
  subIndex: number,
): Block[] {
  const blocks: Block[] = [];
  const baseId = `msg-${role}-${turnIndex}-${subIndex}`;

  if (typeof content === 'string') {
    blocks.push({
      id: baseId,
      category: role === 'user' ? 'user_message' : 'assistant_message',
      text: content,
    });
    return blocks;
  }

  if (Array.isArray(content)) {
    content.forEach((part, i) => {
      if (!part || typeof part !== 'object') { return; }
      const p = part as Record<string, unknown>;
      const type = asString(p['type']) ?? 'text';
      const id = `${baseId}-${i}`;
      if (type === 'text') {
        blocks.push({
          id,
          category: role === 'user' ? 'user_message' : 'assistant_message',
          text: asString(p['text']) ?? '',
        });
      } else if (type === 'tool_result') {
        const t = p['content'];
        let text = '';
        if (typeof t === 'string') { text = t; }
        else if (Array.isArray(t)) {
          text = t.map((c) => (c && typeof c === 'object' ? asString((c as Record<string, unknown>)['text']) ?? '' : '')).join('\n');
        }
        blocks.push({ id, category: 'tool_result', text });
      } else if (type === 'image' || type === 'document') {
        blocks.push({ id, category: 'attachment', text: asString(p['source']) ?? JSON.stringify(p) });
      } else if (type === 'tool_use') {
        blocks.push({ id, category: 'assistant_message', text: JSON.stringify(p) });
      }
    });
  }

  return blocks;
}

/**
 * Convert one Anthropic-style `messages.create` payload into a RawTurn.
 * Accepts either the raw request body directly or a `{ request, response }`
 * wrapper common in SDK debug dumps.
 */
export function payloadToRawTurn(
  payload: Record<string, unknown>,
  session_id: string,
  turn: number,
): RawTurn {
  const body = (payload['request'] && typeof payload['request'] === 'object')
    ? (payload['request'] as Record<string, unknown>)
    : payload;

  const model = asString(body['model']);
  const blocks: Block[] = [];

  const tools = body['tools'];
  if (Array.isArray(tools)) {
    tools.forEach((tool, i) => {
      if (!tool || typeof tool !== 'object') { return; }
      const t = tool as Record<string, unknown>;
      const name = asString(t['name']) ?? `tool-${i}`;
      const description = asString(t['description']) ?? '';
      const schema = t['input_schema'] ?? t['inputSchema'];
      const server = asString(t['server']) ?? asString(t['mcp_server']);
      const isMcp = Boolean(server) || name.includes('/');
      const derivedServer = server ?? (name.includes('/') ? name.split('/')[0] : undefined);
      const text = `${name}: ${description}\n${JSON.stringify(schema ?? {})}`;
      blocks.push({
        id: `tool-${i}-${name}`,
        category: isMcp ? 'mcp_tool' : 'built_in_tool',
        text,
        name,
        server: isMcp ? derivedServer : undefined,
        meta: { schema: schema ?? null },
      });
    });
  }

  const system = body['system'];
  if (typeof system === 'string') {
    blocks.push({ id: 'sys-0', category: 'system', text: system });
  } else if (Array.isArray(system)) {
    system.forEach((part, i) => {
      if (!part || typeof part !== 'object') { return; }
      const p = part as Record<string, unknown>;
      const text = asString(p['text']) ?? '';
      const cc = p['cache_control'];
      const block: Block = { id: `sys-${i}`, category: 'system', text };
      if (cc && typeof cc === 'object') {
        const ccObj = cc as Record<string, unknown>;
        const type = asString(ccObj['type']);
        const ttl = asString(ccObj['ttl']);
        if (type === 'ephemeral') {
          block.cache_control = { type: 'ephemeral', ttl: ttl === '1h' ? '1h' : '5m' };
        }
      }
      blocks.push(block);
    });
  }

  const messages = body['messages'];
  if (Array.isArray(messages)) {
    messages.forEach((m, i) => {
      if (!m || typeof m !== 'object') { return; }
      const msg = m as Record<string, unknown>;
      const role = asString(msg['role']);
      if (role !== 'user' && role !== 'assistant') { return; }
      blocks.push(...blockFromAnthropicMessage(turn, role, msg['content'], i));
    });
  }

  return { session_id, turn, model, blocks };
}

// --- JSONL ---------------------------------------------------------------

/**
 * Parse a JSONL file where each line is a serialised Anthropic request body
 * (or `{ session_id?, turn?, request }` wrapper). Consecutive lines without
 * an explicit `session_id` are grouped into one session.
 */
export function ingestJsonl(filePath: string): IngestedSession[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ingestJsonl: file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const sessions = new Map<string, RawTurn[]>();
  let lineNo = 0;
  const defaultSession = `jsonl:${path.basename(filePath)}`;

  for (const rawLine of raw.split('\n')) {
    lineNo++;
    const line = rawLine.trim();
    if (!line) { continue; }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(`ingestJsonl: malformed JSON on line ${lineNo} of ${filePath}: ${(err as Error).message}`);
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`ingestJsonl: line ${lineNo} is not an object`);
    }
    const obj = parsed as Record<string, unknown>;
    const sessionId = asString(obj['session_id']) ?? defaultSession;
    const bucket = sessions.get(sessionId) ?? [];
    const turnIndex = typeof obj['turn'] === 'number' ? (obj['turn'] as number) : bucket.length;
    bucket.push(payloadToRawTurn(obj, sessionId, turnIndex));
    sessions.set(sessionId, bucket);
  }

  return Array.from(sessions.entries()).map(([session_id, turns]) => ({
    session_id,
    model: turns[0]?.model,
    turns: turns.map((t) => ({ ...t })),
  }));
}

// --- HAR -----------------------------------------------------------------

/**
 * Parse a `.har` capture and extract every `api.anthropic.com` /messages
 * POST body. Each request becomes one turn; all requests in the file share
 * one session id derived from the file name (HARs usually represent one
 * recording session anyway).
 */
export function ingestHar(filePath: string): IngestedSession[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ingestHar: file not found: ${filePath}`);
  }
  let doc: unknown;
  try {
    doc = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`ingestHar: invalid JSON in ${filePath}: ${(err as Error).message}`);
  }
  if (!doc || typeof doc !== 'object') {
    throw new Error(`ingestHar: ${filePath} is not a HAR document`);
  }
  const log = (doc as Record<string, unknown>)['log'];
  if (!log || typeof log !== 'object') {
    throw new Error(`ingestHar: ${filePath} missing .log`);
  }
  const entries = (log as Record<string, unknown>)['entries'];
  if (!Array.isArray(entries)) {
    throw new Error(`ingestHar: ${filePath} missing .log.entries`);
  }

  const session_id = `har:${path.basename(filePath)}`;
  const turns: RawTurn[] = [];
  let turnIndex = 0;

  for (const entryRaw of entries) {
    if (!entryRaw || typeof entryRaw !== 'object') { continue; }
    const entry = entryRaw as Record<string, unknown>;
    const req = entry['request'] as Record<string, unknown> | undefined;
    if (!req) { continue; }
    const url = asString(req['url']) ?? '';
    const method = asString(req['method']) ?? '';
    if (method.toUpperCase() !== 'POST') { continue; }
    if (!/anthropic\.com|openai\.com/.test(url)) { continue; }
    if (!/messages|\/chat\/completions/.test(url)) { continue; }
    const postData = req['postData'] as Record<string, unknown> | undefined;
    const text = postData ? asString(postData['text']) : undefined;
    if (!text) { continue; }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch (err) {
      throw new Error(`ingestHar: entry ${turnIndex} has invalid JSON body: ${(err as Error).message}`);
    }
    if (!body || typeof body !== 'object') {
      throw new Error(`ingestHar: entry ${turnIndex} body is not an object`);
    }
    turns.push(payloadToRawTurn(body as Record<string, unknown>, session_id, turnIndex));
    turnIndex++;
  }

  if (turns.length === 0) { return []; }
  return [{ session_id, model: turns[0].model, turns }];
}

// --- In-memory log entries (shared with scanner/logs.ts) -----------------

/**
 * Minimal duck-typed view of `src/core/scanner/logs.ts` `LogEntry`. We
 * deliberately avoid importing that type to keep the Promptimizer core free
 * of cross-module coupling.
 */
export interface LogEntryLike {
  timestamp?: string;
  message?: string;
  source?: string;
  data?: unknown;
}

function extractAnthropicCandidate(entry: LogEntryLike): Record<string, unknown> | undefined {
  const inspect = (v: unknown): Record<string, unknown> | undefined => {
    if (!v || typeof v !== 'object') { return undefined; }
    const obj = v as Record<string, unknown>;
    const inner = (obj['request'] && typeof obj['request'] === 'object')
      ? (obj['request'] as Record<string, unknown>)
      : (obj['payload'] && typeof obj['payload'] === 'object')
        ? (obj['payload'] as Record<string, unknown>)
        : obj;
    if (inner['messages'] || inner['system'] || inner['tools']) {
      return inner;
    }
    return undefined;
  };
  const fromData = inspect(entry.data);
  if (fromData) { return fromData; }
  if (typeof entry.message === 'string' && entry.message.trim().startsWith('{')) {
    try { return inspect(JSON.parse(entry.message)); } catch { /* ignore */ }
  }
  return undefined;
}

/**
 * Ingest already-parsed Copilot log entries (as produced by
 * `src/core/scanner/logs.ts` `scanCopilotLogs()`). Entries whose `data` or
 * `message` contain an Anthropic-style request body are converted to turns;
 * the rest are skipped. Sessions are grouped by the originating file path.
 */
export function ingestFromLogEntries(entries: readonly LogEntryLike[]): IngestedSession[] {
  const sessions = new Map<string, RawTurn[]>();
  for (const entry of entries) {
    const candidate = extractAnthropicCandidate(entry);
    if (!candidate) { continue; }
    const sessionId = entry.source
      ? `copilot-chat:${path.basename(path.dirname(entry.source))}`
      : 'copilot-chat:unknown';
    const bucket = sessions.get(sessionId) ?? [];
    bucket.push(payloadToRawTurn(candidate, sessionId, bucket.length));
    sessions.set(sessionId, bucket);
  }
  return Array.from(sessions.entries()).map(([session_id, turns]) => ({
    session_id,
    model: turns[0]?.model,
    turns: turns.map((t) => ({ ...t })),
  }));
}

// --- Copilot CLI session events (~/.copilot/session-state) ---------------

function copilotSessionRoot(): string {
  return path.join(os.homedir(), '.copilot', 'session-state');
}

function copilotDebugLogRoot(): string {
  return path.join(os.homedir(), '.copilot', 'logs');
}

/**
 * Scan `~/.copilot/logs/process-*.log` for `assistant_usage` telemetry blobs
 * and sum authoritative API token usage per `session_id`. These are the
 * numbers the Anthropic backend actually bills.
 */
export function readDebugLogUsage(): Map<string, import('./types').SessionUsage> {
  const out = new Map<string, import('./types').SessionUsage>();
  const root = copilotDebugLogRoot();
  if (!fs.existsSync(root)) { return out; }
  let files: string[];
  try {
    files = fs.readdirSync(root).filter((f) => f.startsWith('process-') && f.endsWith('.log'));
  } catch { return out; }
  for (const f of files) {
    try {
      const text = fs.readFileSync(path.join(root, f), 'utf8');
      aggregateUsageFromDebugLogText(text, out);
    } catch { /* skip unreadable files */ }
  }
  return out;
}

/** Exported for tests. Accumulates usage by session_id from one log file's text. */
export function aggregateUsageFromDebugLogText(
  text: string,
  out: Map<string, import('./types').SessionUsage>,
): void {
  const marker = '"kind": "assistant_usage"';
  let pos = 0;
  while (true) {
    const idx = text.indexOf(marker, pos);
    if (idx < 0) { break; }
    const brace = text.lastIndexOf('\n{', idx);
    if (brace < 0) { pos = idx + marker.length; continue; }
    // find matching close brace via depth counting
    let j = brace + 1;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (; j < text.length; j++) {
      const c = text[j];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) { continue; }
      if (c === '{') { depth++; }
      else if (c === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end < 0) { break; }
    const blob = text.slice(brace + 1, end + 1);
    pos = end + 1;
    let obj: unknown;
    try { obj = JSON.parse(blob); } catch { continue; }
    if (!obj || typeof obj !== 'object') { continue; }
    const rec = obj as Record<string, unknown>;
    const sid = typeof rec['session_id'] === 'string' ? (rec['session_id'] as string) : undefined;
    if (!sid) { continue; }
    const metrics = (rec['metrics'] ?? {}) as Record<string, unknown>;
    const num = (k: string): number => (typeof metrics[k] === 'number' ? (metrics[k] as number) : 0);
    const inputUncached = num('input_tokens_uncached');
    const cacheRead = num('cache_read_tokens');
    const cacheWrite = num('cache_write_tokens');
    const output = num('output_tokens');
    const acc = out.get(sid) ?? { inputUncached: 0, cacheRead: 0, cacheWrite: 0, output: 0, apiCalls: 0, source: 'copilot-debug-log' as const };
    acc.inputUncached += inputUncached;
    acc.cacheRead += cacheRead;
    acc.cacheWrite += cacheWrite;
    acc.output += output;
    acc.apiCalls += 1;
    out.set(sid, acc);
  }
}

// --- session.shutdown modelMetrics from events.jsonl ----------------------

interface ShutdownResult {
  totalPremiumRequests: number;
  totalApiDurationMs: number;
  modelMetrics: ModelMetrics[];
  usage: import('./types').SessionUsage;
}

/** Parse a session.shutdown event's data into structured metrics. */
export function parseShutdownMetrics(data: Record<string, unknown>): ShutdownResult | undefined {
  const rawMetrics = data['modelMetrics'];
  if (!rawMetrics || typeof rawMetrics !== 'object' || Array.isArray(rawMetrics)) { return undefined; }
  const totalPremium = typeof data['totalPremiumRequests'] === 'number' ? (data['totalPremiumRequests'] as number) : 0;
  const totalDuration = typeof data['totalApiDurationMs'] === 'number' ? (data['totalApiDurationMs'] as number) : 0;

  const metrics: ModelMetrics[] = [];
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalCalls = 0;

  for (const [model, value] of Object.entries(rawMetrics as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') { continue; }
    const v = value as Record<string, unknown>;
    const requests = (v['requests'] && typeof v['requests'] === 'object') ? (v['requests'] as Record<string, unknown>) : {};
    const usage = (v['usage'] && typeof v['usage'] === 'object') ? (v['usage'] as Record<string, unknown>) : {};
    const num = (obj: Record<string, unknown>, k: string): number =>
      typeof obj[k] === 'number' ? (obj[k] as number) : 0;

    const m: ModelMetrics = {
      model,
      requests: num(requests, 'count'),
      cost: num(requests, 'cost'),
      inputTokens: num(usage, 'inputTokens'),
      outputTokens: num(usage, 'outputTokens'),
      cacheReadTokens: num(usage, 'cacheReadTokens'),
      cacheWriteTokens: num(usage, 'cacheWriteTokens'),
    };
    metrics.push(m);
    totalInput += m.inputTokens;
    totalOutput += m.outputTokens;
    totalCacheRead += m.cacheReadTokens;
    totalCacheWrite += m.cacheWriteTokens;
    totalCalls += m.requests;
  }

  if (metrics.length === 0) { return undefined; }
  return {
    totalPremiumRequests: totalPremium,
    totalApiDurationMs: totalDuration,
    modelMetrics: metrics,
    usage: {
      inputUncached: Math.max(0, totalInput - totalCacheRead),
      cacheWrite: totalCacheWrite,
      cacheRead: totalCacheRead,
      output: totalOutput,
      apiCalls: totalCalls,
      source: 'shutdown-event',
    },
  };
}

// --- session_usage_info from debug logs -----------------------------------

/** Parse session_usage_info telemetry blobs from debug log text. */
export function parseContextWindowSnapshots(text: string): Map<string, ContextWindowSnapshot[]> {
  const out = new Map<string, ContextWindowSnapshot[]>();
  const markers = ['"kind": "session_usage_info"', '"kind":"session_usage_info"'];
  let pos = 0;
  while (true) {
    let idx = -1;
    for (const m of markers) {
      const found = text.indexOf(m, pos);
      if (found >= 0 && (idx < 0 || found < idx)) { idx = found; }
    }
    if (idx < 0) { break; }
    const brace = text.lastIndexOf('\n{', idx);
    if (brace < 0) { pos = idx + 1; continue; }
    let j = brace + 1;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (; j < text.length; j++) {
      const c = text[j];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) { continue; }
      if (c === '{') { depth++; }
      else if (c === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end < 0) { break; }
    const blob = text.slice(brace + 1, end + 1);
    pos = end + 1;
    let obj: unknown;
    try { obj = JSON.parse(blob); } catch { continue; }
    if (!obj || typeof obj !== 'object') { continue; }
    const rec = obj as Record<string, unknown>;
    const sid = typeof rec['session_id'] === 'string' ? (rec['session_id'] as string) : undefined;
    if (!sid) { continue; }
    const metrics = (rec['metrics'] ?? {}) as Record<string, unknown>;
    const num = (k: string): number => (typeof metrics[k] === 'number' ? (metrics[k] as number) : 0);
    const snapshot: ContextWindowSnapshot = {
      tokenLimit: num('token_limit'),
      currentTokens: num('current_tokens'),
      systemTokens: num('system_tokens'),
      conversationTokens: num('conversation_tokens'),
      toolDefinitionsTokens: num('tool_definitions_tokens'),
      messagesLength: num('messages_length'),
    };
    if (snapshot.tokenLimit > 0) {
      const arr = out.get(sid) ?? [];
      arr.push(snapshot);
      out.set(sid, arr);
    }
  }
  return out;
}

/** Read context-window snapshots from all debug logs. */
export function readContextWindowSnapshots(): Map<string, ContextWindowSnapshot[]> {
  const out = new Map<string, ContextWindowSnapshot[]>();
  const root = copilotDebugLogRoot();
  if (!fs.existsSync(root)) { return out; }
  let files: string[];
  try {
    files = fs.readdirSync(root).filter((f) => f.startsWith('process-') && f.endsWith('.log'));
  } catch { return out; }
  for (const f of files) {
    try {
      const text = fs.readFileSync(path.join(root, f), 'utf8');
      const partial = parseContextWindowSnapshots(text);
      for (const [sid, snaps] of partial) {
        const existing = out.get(sid) ?? [];
        existing.push(...snaps);
        out.set(sid, existing);
      }
    } catch { /* skip */ }
  }
  return out;
}

// --- VS Code debug-logs/main.jsonl ----------------------------------------

function vscodeWorkspaceStorageRoot(): string {
  const homeDir = os.homedir();
  switch (process.platform) {
    case 'win32':
      return path.join(process.env['APPDATA'] ?? '', 'Code', 'User', 'workspaceStorage');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
    case 'linux':
      return path.join(homeDir, '.config', 'Code', 'User', 'workspaceStorage');
    default:
      return '';
  }
}

interface VscodeDebugLogEntry {
  ts?: number;
  dur?: number;
  type?: string;
  name?: string;
  attrs?: Record<string, unknown>;
}

/**
 * Discover `main.jsonl` files under VS Code workspaceStorage debug-logs.
 * Path: `<workspaceStorage>/<hash>/GitHub.copilot-chat/debug-logs/<session>/main.jsonl`.
 */
export function discoverVscodeDebugLogFiles(): string[] {
  const root = vscodeWorkspaceStorageRoot();
  if (!root || !fs.existsSync(root)) { return []; }
  const out: string[] = [];
  let workspaces: fs.Dirent[];
  try { workspaces = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const ws of workspaces) {
    if (!ws.isDirectory()) { continue; }
    const debugDir = path.join(root, ws.name, 'GitHub.copilot-chat', 'debug-logs');
    if (!fs.existsSync(debugDir)) { continue; }
    let sessions: fs.Dirent[];
    try { sessions = fs.readdirSync(debugDir, { withFileTypes: true }); } catch { continue; }
    for (const sess of sessions) {
      if (!sess.isDirectory()) { continue; }
      const mainJsonl = path.join(debugDir, sess.name, 'main.jsonl');
      if (fs.existsSync(mainJsonl)) {
        out.push(mainJsonl);
      }
    }
  }
  return out;
}

/**
 * Parse a VS Code `main.jsonl` debug log file and extract `llm_request` spans
 * with per-call inputTokens, outputTokens, model, ttft, and duration.
 */
export function parseVscodeDebugLog(filePath: string): import('./types').SessionUsage | undefined {
  let content: string;
  try { content = fs.readFileSync(filePath, 'utf-8'); } catch { return undefined; }
  let totalInput = 0;
  let totalOutput = 0;
  let apiCalls = 0;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line[0] !== '{') { continue; }
    let parsed: VscodeDebugLogEntry;
    try { parsed = JSON.parse(line) as VscodeDebugLogEntry; } catch { continue; }
    if (parsed.type !== 'llm_request') { continue; }
    const attrs = parsed.attrs;
    if (!attrs) { continue; }
    const input = typeof attrs['inputTokens'] === 'number' ? (attrs['inputTokens'] as number) : 0;
    const output = typeof attrs['outputTokens'] === 'number' ? (attrs['outputTokens'] as number) : 0;
    totalInput += input;
    totalOutput += output;
    apiCalls++;
  }

  if (apiCalls === 0) { return undefined; }
  return {
    inputUncached: totalInput,
    cacheWrite: 0,
    cacheRead: 0,
    output: totalOutput,
    apiCalls,
    source: 'vscode-debug-log',
  };
}

/**
 * Ingest VS Code debug-log main.jsonl files for per-session usage data.
 * Returns sessions with authoritative token counts from VS Code's own tracing.
 */
export function ingestVscodeDebugLogs(): IngestedSession[] {
  const files = discoverVscodeDebugLogFiles();
  const out: IngestedSession[] = [];
  for (const file of files) {
    const usage = parseVscodeDebugLog(file);
    if (!usage) { continue; }
    const sessionDir = path.basename(path.dirname(file));
    const session_id = `vscode-debug:${sessionDir}`;
    out.push({
      session_id,
      turns: [],
      usage,
      label: `VS Code debug session [${sessionDir.slice(0, 8)}]`,
      startedAt: undefined,
    });
  }
  return out;
}

interface CopilotEvent {
  type: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

function readCopilotEvents(file: string): CopilotEvent[] {
  const events: CopilotEvent[] = [];
  let content: string;
  try {
    content = fs.readFileSync(file, 'utf-8');
  } catch {
    return events;
  }
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line[0] !== '{') { continue; }
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
        events.push(parsed as CopilotEvent);
      }
    } catch { /* skip malformed lines */ }
  }
  return events;
}

function toolRequestsText(toolRequests: unknown): string {
  if (!Array.isArray(toolRequests)) { return ''; }
  const parts: string[] = [];
  for (const tr of toolRequests) {
    if (!tr || typeof tr !== 'object') { continue; }
    const t = tr as Record<string, unknown>;
    const name = asString(t['name']) ?? 'tool';
    const args = t['arguments'];
    parts.push(`${name}(${typeof args === 'string' ? args : JSON.stringify(args ?? {})})`);
  }
  return parts.join('\n');
}

function firstPromptSummary(text: string, maxLen = 60): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLen) { return oneLine; }
  return `${oneLine.slice(0, maxLen - 1)}…`;
}

function readSessionTitle(sessionDir: string): string | undefined {
  const jsonFile = path.join(sessionDir, 'session.json');
  try {
    const raw = fs.readFileSync(jsonFile, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const t = parsed['title'];
    return typeof t === 'string' && t.trim() ? t.trim() : undefined;
  } catch {
    return undefined;
  }
}

function labelFor(context: Record<string, string> | undefined, firstPrompt: string | undefined, shortId: string, copilotTitle?: string): string {
  if (copilotTitle) { return `${copilotTitle} [${shortId}]`; }
  const parts: string[] = [];
  if (context?.['repository']) {
    parts.push(context['branch'] ? `${context['repository']}@${context['branch']}` : context['repository']);
  } else if (context?.['cwd']) {
    parts.push(path.basename(context['cwd']));
  }
  if (firstPrompt) { parts.push(`“${firstPromptSummary(firstPrompt)}”`); }
  if (parts.length === 0) { return shortId; }
  return `${parts.join(' — ')} [${shortId}]`;
}

function buildSessionFromEvents(sessionId: string, events: CopilotEvent[], copilotTitle?: string): IngestedSession | undefined {
  let model: string | undefined;
  let systemContext: Block | undefined;
  let context: Record<string, string> | undefined;
  let firstPrompt: string | undefined;
  let startedAt: string | undefined;
  let shutdownData: ReturnType<typeof parseShutdownMetrics> | undefined;
  const turns: RawTurn[] = [];
  let current: { blocks: Block[]; idx: number } | undefined;
  let subIdx = 0;

  const newTurn = (idx: number): { blocks: Block[]; idx: number } => {
    const blocks: Block[] = [];
    if (systemContext) {
      blocks.push({ ...systemContext });
    }
    return { blocks, idx };
  };

  const pushCurrent = (): void => {
    if (current && current.blocks.length > 0) {
      turns.push({ session_id: sessionId, turn: current.idx, model, blocks: current.blocks });
    }
  };

  for (const ev of events) {
    const data = ev.data ?? {};
    if (!startedAt && typeof ev.timestamp === 'string') { startedAt = ev.timestamp; }
    switch (ev.type) {
      case 'session.start': {
        const ctx = data['context'];
        if (ctx && typeof ctx === 'object') {
          context = {};
          for (const [k, v] of Object.entries(ctx as Record<string, unknown>)) {
            if (typeof v === 'string') { context[k] = v; }
          }
          systemContext = {
            id: `sys-ctx-${sessionId}`,
            category: 'system',
            text: JSON.stringify(ctx),
          };
        }
        break;
      }
      case 'session.model_change': {
        const m = asString(data['newModel']);
        if (m) { model = m; }
        break;
      }
      case 'user.message': {
        pushCurrent();
        current = newTurn(turns.length);
        subIdx = 0;
        const text = asString(data['content']) ?? asString(data['transformedContent']) ?? '';
        if (!firstPrompt && text) { firstPrompt = text; }
        const blockText = asString(data['transformedContent']) ?? text;
        current.blocks.push({ id: `msg-u-${current.idx}`, category: 'user_message', text: blockText });
        break;
      }
      case 'assistant.message': {
        if (!current) { current = newTurn(turns.length); subIdx = 0; }
        const content = asString(data['content']) ?? '';
        const outTokens = typeof data['outputTokens'] === 'number' ? (data['outputTokens'] as number) : undefined;
        if (content) {
          current.blocks.push({
            id: `msg-a-${current.idx}-${subIdx++}`,
            category: 'assistant_message',
            text: content,
            ...(outTokens !== undefined ? { tokens: outTokens } : {}),
          });
        }
        const toolText = toolRequestsText(data['toolRequests']);
        if (toolText) {
          current.blocks.push({
            id: `msg-a-tool-${current.idx}-${subIdx++}`,
            category: 'assistant_message',
            text: toolText,
          });
        }
        break;
      }
      case 'tool.execution_complete': {
        if (!current) { current = newTurn(turns.length); subIdx = 0; }
        const result = data['result'];
        const text = result && typeof result === 'object'
          ? (asString((result as Record<string, unknown>)['content']) ?? JSON.stringify(result))
          : asString(result) ?? '';
        const name = asString(data['toolName']) ?? 'tool';
        current.blocks.push({
          id: `tool-result-${current.idx}-${subIdx++}`,
          category: 'tool_result',
          text,
          name,
        });
        break;
      }
      case 'subagent.completed': {
        if (!current) { current = newTurn(turns.length); subIdx = 0; }
        const totalTokens = typeof data['totalTokens'] === 'number' ? (data['totalTokens'] as number) : 0;
        if (totalTokens > 0) {
          const agentName = asString(data['agentName']) ?? 'subagent';
          current.blocks.push({
            id: `subagent-${current.idx}-${subIdx++}`,
            category: 'tool_result',
            text: `[subagent total: ${totalTokens} tokens]`,
            name: `subagent:${agentName}`,
            tokens: totalTokens,
          });
        }
        break;
      }
      case 'session.shutdown': {
        shutdownData = parseShutdownMetrics(data);
        break;
      }
      default:
        break;
    }
  }
  pushCurrent();

  if (turns.length === 0) { return undefined; }
  const shortId = sessionId.split(':').pop()?.slice(0, 8) ?? sessionId;
  const session: IngestedSession = {
    session_id: sessionId,
    model,
    turns,
    label: labelFor(context, firstPrompt, shortId, copilotTitle),
    context,
    firstPrompt: firstPrompt ? firstPromptSummary(firstPrompt, 200) : undefined,
    startedAt,
  };
  if (shutdownData) {
    session.usage = shutdownData.usage;
    session.modelMetrics = shutdownData.modelMetrics;
    session.premiumRequests = shutdownData.totalPremiumRequests;
    session.totalApiDurationMs = shutdownData.totalApiDurationMs;
  }
  return session;
}

/**
 * Ingest Copilot CLI session events from `~/.copilot/session-state/<id>/events.jsonl`.
 *
 * These files capture full user/assistant/tool turns for every Copilot CLI
 * conversation on this workstation, making them the richest locally-available
 * source of prompt context — far more complete than VS Code's default-level
 * GitHub Copilot Chat logs, which contain no prompt payloads.
 */
export function ingestCopilotSessions(): IngestedSession[] {
  const root = copilotSessionRoot();
  if (!fs.existsSync(root)) { return []; }
  const out: IngestedSession[] = [];
  let dirs: fs.Dirent[];
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const d of dirs) {
    if (!d.isDirectory()) { continue; }
    const sessionDir = path.join(root, d.name);
    const file = path.join(sessionDir, 'events.jsonl');
    if (!fs.existsSync(file)) { continue; }
    const events = readCopilotEvents(file);
    if (events.length === 0) { continue; }
    const copilotTitle = readSessionTitle(sessionDir);
    const session = buildSessionFromEvents(`copilot-session:${d.name}`, events, copilotTitle);
    if (session) { out.push(session); }
  }
  // Attach authoritative usage from debug logs (best-effort).
  // Shutdown-event usage takes priority; fall back to per-call debug-log usage.
  try {
    const usage = readDebugLogUsage();
    for (const s of out) {
      const rawId = s.session_id.startsWith('copilot-session:') ? s.session_id.slice('copilot-session:'.length) : s.session_id;
      const u = usage.get(rawId);
      if (u && !s.usage) { s.usage = u; }
    }
  } catch { /* non-fatal */ }
  // Attach context-window snapshots from debug logs (best-effort).
  try {
    const snapshots = readContextWindowSnapshots();
    for (const s of out) {
      const rawId = s.session_id.startsWith('copilot-session:') ? s.session_id.slice('copilot-session:'.length) : s.session_id;
      const snaps = snapshots.get(rawId);
      if (snaps && snaps.length > 0) { s.contextSnapshots = snaps; }
    }
  } catch { /* non-fatal */ }
  return out;
}

// --- Copilot CLI chat history (history-session-state) --------------------

function copilotHistoryRoot(): string {
  return path.join(os.homedir(), '.copilot', 'history-session-state');
}

interface HistoryChatMessage {
  role?: string;
  content?: unknown;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
}

interface HistoryFile {
  sessionId?: string;
  startTime?: string;
  model?: string;
  cwd?: string;
  repository?: string;
  branch?: string;
  title?: string;
  chatMessages?: HistoryChatMessage[];
  timeline?: unknown;
}

function messageContentToText(content: unknown): string {
  if (typeof content === 'string') { return content; }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const p of content) {
      if (typeof p === 'string') { parts.push(p); }
      else if (p && typeof p === 'object') {
        const o = p as Record<string, unknown>;
        if (typeof o['text'] === 'string') { parts.push(o['text'] as string); }
        else if (typeof o['content'] === 'string') { parts.push(o['content'] as string); }
        else { parts.push(JSON.stringify(o)); }
      }
    }
    return parts.join('\n');
  }
  if (content && typeof content === 'object') {
    try { return JSON.stringify(content); } catch { return ''; }
  }
  return '';
}

function toolCallsToText(toolCalls: unknown): string {
  if (!Array.isArray(toolCalls)) { return ''; }
  const parts: string[] = [];
  for (const tc of toolCalls) {
    if (!tc || typeof tc !== 'object') { continue; }
    const o = tc as Record<string, unknown>;
    const fn = o['function'] as Record<string, unknown> | undefined;
    const name = asString(fn?.['name']) ?? asString(o['name']) ?? 'tool';
    const args = fn?.['arguments'] ?? o['arguments'];
    parts.push(`${name}(${typeof args === 'string' ? args : JSON.stringify(args ?? {})})`);
  }
  return parts.join('\n');
}

function buildSessionFromHistory(file: HistoryFile, sessionId: string): IngestedSession | undefined {
  const messages = Array.isArray(file.chatMessages) ? file.chatMessages : [];
  if (messages.length === 0) { return undefined; }

  const context: Record<string, string> = {};
  if (file.cwd) { context['cwd'] = file.cwd; }
  if (file.repository) { context['repository'] = file.repository; }
  if (file.branch) { context['branch'] = file.branch; }

  const turns: RawTurn[] = [];
  let current: { blocks: Block[]; idx: number } | undefined;
  let subIdx = 0;
  let firstPrompt: string | undefined;

  const pushCurrent = (): void => {
    if (current && current.blocks.length > 0) {
      turns.push({ session_id: sessionId, turn: current.idx, model: file.model, blocks: current.blocks });
    }
  };

  for (const msg of messages) {
    const role = msg.role ?? 'user';
    if (role === 'user') {
      pushCurrent();
      current = { blocks: [], idx: turns.length };
      subIdx = 0;
      const text = messageContentToText(msg.content);
      if (!firstPrompt && text) { firstPrompt = text; }
      current.blocks.push({ id: `msg-u-${current.idx}`, category: 'user_message', text });
      continue;
    }
    if (!current) { current = { blocks: [], idx: turns.length }; subIdx = 0; }
    if (role === 'assistant') {
      const text = messageContentToText(msg.content);
      if (text) {
        current.blocks.push({
          id: `msg-a-${current.idx}-${subIdx++}`,
          category: 'assistant_message',
          text,
        });
      }
      const toolText = toolCallsToText(msg.tool_calls);
      if (toolText) {
        current.blocks.push({
          id: `msg-a-tool-${current.idx}-${subIdx++}`,
          category: 'assistant_message',
          text: toolText,
        });
      }
    } else if (role === 'tool') {
      const text = messageContentToText(msg.content);
      current.blocks.push({
        id: `tool-result-${current.idx}-${subIdx++}`,
        category: 'tool_result',
        text,
        name: msg.name ?? 'tool',
      });
    }
  }
  pushCurrent();

  if (turns.length === 0) { return undefined; }
  const shortId = sessionId.split(':').pop()?.slice(0, 8) ?? sessionId;
  return {
    session_id: sessionId,
    model: file.model,
    turns,
    label: labelFor(context, firstPrompt, shortId, file.title || undefined),
    context: Object.keys(context).length ? context : undefined,
    firstPrompt: firstPrompt ? firstPromptSummary(firstPrompt, 200) : undefined,
    startedAt: file.startTime,
  };
}

/**
 * Ingest Copilot CLI history files from `~/.copilot/history-session-state/*.json`.
 *
 * Each file is a full chat transcript with `chatMessages` containing user,
 * assistant, and tool messages (including `tool_calls` with arguments). This
 * source has larger, richer text than the event-stream ingest and therefore
 * surfaces many more optimization findings.
 */
export function ingestCopilotHistorySessions(): IngestedSession[] {
  const root = copilotHistoryRoot();
  if (!fs.existsSync(root)) { return []; }
  const out: IngestedSession[] = [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.json')) { continue; }
    const full = path.join(root, e.name);
    let raw: string;
    try { raw = fs.readFileSync(full, 'utf-8'); } catch { continue; }
    let parsed: HistoryFile;
    try { parsed = JSON.parse(raw) as HistoryFile; } catch { continue; }
    const sid = parsed.sessionId ?? e.name.replace(/\.json$/, '');
    const session = buildSessionFromHistory(parsed, `copilot-history:${sid}`);
    if (session) { out.push(session); }
  }
  return out;
}

// --- Copilot Chat --------------------------------------------------------

/**
 * Best-effort ingest of Copilot Chat trace logs. Modern Copilot Chat emits
 * one JSON object per captured prompt payload with a `type: "prompt"` (or
 * similar) envelope; older builds embed the payload inside a log line. We
 * accept both and skip lines we cannot parse.
 *
 * Reuses the log-root discovery pattern from `src/core/scanner/logs.ts`.
 */
export function ingestCopilotChatLogs(): IngestedSession[] {
  const files = discoverCopilotChatLogFiles();
  const sessions = new Map<string, RawTurn[]>();

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    const sessionId = `copilot-chat:${path.basename(path.dirname(file))}`;
    const bucket = sessions.get(sessionId) ?? [];

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line[0] !== '{') { continue; }
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== 'object') { continue; }
      const obj = parsed as Record<string, unknown>;
      const candidate = (obj['request'] ?? obj['payload'] ?? obj) as Record<string, unknown>;
      if (!candidate || typeof candidate !== 'object') { continue; }
      if (!candidate['messages'] && !candidate['system'] && !candidate['tools']) { continue; }
      const turn = typeof obj['turn'] === 'number' ? (obj['turn'] as number) : bucket.length;
      bucket.push(payloadToRawTurn(candidate, sessionId, turn));
    }

    if (bucket.length > 0) { sessions.set(sessionId, bucket); }
  }

  return Array.from(sessions.entries()).map(([session_id, turns]) => ({
    session_id,
    model: turns[0]?.model,
    turns: turns.map((t) => ({ ...t })),
  }));
}
