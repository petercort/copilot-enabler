// Ingest adapters: Copilot Chat logs, JSONL dumps, and .har captures.
//
// Pure Node-only: no `vscode` imports. The Copilot Chat path reuses the log
// directory discovery from `src/core/scanner/logs.ts` via `getLogRoots()`.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Block, IngestedSession, RawTurn } from './types';

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

function labelFor(context: Record<string, string> | undefined, firstPrompt: string | undefined, shortId: string): string {
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

function buildSessionFromEvents(sessionId: string, events: CopilotEvent[]): IngestedSession | undefined {
  let model: string | undefined;
  let systemContext: Block | undefined;
  let context: Record<string, string> | undefined;
  let firstPrompt: string | undefined;
  let startedAt: string | undefined;
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
        if (content) {
          current.blocks.push({
            id: `msg-a-${current.idx}-${subIdx++}`,
            category: 'assistant_message',
            text: content,
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
      default:
        break;
    }
  }
  pushCurrent();

  if (turns.length === 0) { return undefined; }
  const shortId = sessionId.split(':').pop()?.slice(0, 8) ?? sessionId;
  return {
    session_id: sessionId,
    model,
    turns,
    label: labelFor(context, firstPrompt, shortId),
    context,
    firstPrompt: firstPrompt ? firstPromptSummary(firstPrompt, 200) : undefined,
    startedAt,
  };
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
    const file = path.join(root, d.name, 'events.jsonl');
    if (!fs.existsSync(file)) { continue; }
    const events = readCopilotEvents(file);
    if (events.length === 0) { continue; }
    const session = buildSessionFromEvents(`copilot-session:${d.name}`, events);
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
