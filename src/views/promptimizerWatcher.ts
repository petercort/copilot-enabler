// Live watcher for ~/.copilot/session-state/<id>/events.jsonl files.
// Notifies the user the moment a tool result exceeds the configured threshold,
// so they can fix the problem at its source instead of finding it post-hoc.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

interface WatcherState {
  watcher: fs.FSWatcher;
  filePath: string;
  position: number;     // bytes already consumed from the file
  buffer: string;       // partial trailing line
  recentToolNames: Map<string, string>;  // toolCallId -> toolName, for friendlier alerts
}

let active: WatcherState | undefined;
let outputChannel: vscode.OutputChannel | undefined;

function out(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Copilot Enabler · Promptimizer Watcher');
  }
  return outputChannel;
}

function sessionStateRoot(): string {
  return path.join(os.homedir(), '.copilot', 'session-state');
}

/** Find the most recently modified events.jsonl on disk. */
function findActiveEventsFile(): string | undefined {
  const root = sessionStateRoot();
  if (!fs.existsSync(root)) { return undefined; }
  let best: { file: string; mtime: number } | undefined;
  let dirs: fs.Dirent[];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }); }
  catch { return undefined; }
  for (const d of dirs) {
    if (!d.isDirectory()) { continue; }
    const file = path.join(root, d.name, 'events.jsonl');
    try {
      const stat = fs.statSync(file);
      if (!best || stat.mtimeMs > best.mtime) {
        best = { file, mtime: stat.mtimeMs };
      }
    } catch { /* file missing - skip */ }
  }
  return best?.file;
}

function thresholdBytes(): number {
  // Roughly 4 chars per token, configurable.
  const tokens = vscode.workspace.getConfiguration('copilotEnabler.promptimizer')
    .get<number>('largeToolResultTokens', 3000);
  return Math.max(200, tokens) * 4;
}

function alertBudget(): { count: number; intervalMs: number } {
  return { count: 5, intervalMs: 60_000 };
}

const recentAlerts: number[] = [];
function shouldAlert(): boolean {
  const now = Date.now();
  const { count, intervalMs } = alertBudget();
  while (recentAlerts.length && recentAlerts[0] < now - intervalMs) {
    recentAlerts.shift();
  }
  if (recentAlerts.length >= count) { return false; }
  recentAlerts.push(now);
  return true;
}

function approxTokens(bytes: number): number {
  return Math.round(bytes / 4);
}

async function notifyLargeToolResult(toolName: string, bytes: number): Promise<void> {
  if (!shouldAlert()) { return; }
  const tokens = approxTokens(bytes);
  const action = await vscode.window.showWarningMessage(
    `🐘 Copilot tool '${toolName}' returned ${tokens.toLocaleString()} tokens — this will bloat every subsequent turn.`,
    'Add summarization rule',
    'Open Promptimizer',
    'Dismiss',
  );
  if (action === 'Add summarization rule') {
    await addSummarizationRuleToInstructions();
  } else if (action === 'Open Promptimizer') {
    await vscode.commands.executeCommand('copilotEnabler.promptimizer.open');
  }
}

async function addSummarizationRuleToInstructions(): Promise<void> {
  const file = path.join(os.homedir(), '.copilot', 'copilot-instructions.md');
  const rule = `\n\n## Tool result hygiene (added by Copilot Enabler)\n\nWhen any tool result exceeds ~200 lines (≈3000 tokens), do the following BEFORE responding:\n1. Summarize the relevant findings in ≤10 short bullets.\n2. Discard the raw output from your context — do not quote it back.\n3. Prefer reading files with bounded ranges:\n   - Use \`view\` with \`view_range\` instead of full-file reads\n   - Use \`grep\` with \`head_limit\` instead of dumping all matches\n   - Use \`head -n\` / \`tail -n\` / \`rg --max-count\` to cap raw output\nIf a single read or grep produces more than 200 lines, narrow the query and try again instead of accepting the dump.\n`;
  try {
    let existing = '';
    if (fs.existsSync(file)) {
      existing = fs.readFileSync(file, 'utf-8');
      if (existing.includes('Tool result hygiene (added by Copilot Enabler)')) {
        await vscode.window.showInformationMessage('Summarization rule already present in ~/.copilot/copilot-instructions.md');
        return;
      }
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, existing + rule, 'utf-8');
    const doc = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(doc, { preview: false });
    void vscode.window.showInformationMessage('Added summarization rule to ~/.copilot/copilot-instructions.md');
  } catch (err) {
    void vscode.window.showErrorMessage(`Failed to update copilot-instructions.md: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function processNewLines(state: WatcherState, chunk: string): void {
  state.buffer += chunk;
  const lines = state.buffer.split('\n');
  state.buffer = lines.pop() ?? '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) { continue; }
    let ev: { type?: string; data?: Record<string, unknown> };
    try { ev = JSON.parse(trimmed); } catch { continue; }
    if (!ev || typeof ev.type !== 'string') { continue; }

    if (ev.type === 'tool.execution_start' && ev.data) {
      const id = String(ev.data['toolCallId'] ?? '');
      const name = String(ev.data['toolName'] ?? ev.data['name'] ?? 'tool');
      if (id) { state.recentToolNames.set(id, name); }
    } else if (ev.type === 'tool.execution_complete' && ev.data) {
      const id = String(ev.data['toolCallId'] ?? '');
      const result = ev.data['result'];
      let bytes = 0;
      if (typeof result === 'string') { bytes = result.length; }
      else if (result && typeof result === 'object') {
        try { bytes = JSON.stringify(result).length; } catch { bytes = 0; }
      }
      if (bytes >= thresholdBytes()) {
        const name = state.recentToolNames.get(id) ?? String(ev.data['toolName'] ?? 'tool');
        out().appendLine(`[${new Date().toISOString()}] Large tool result: ${name} ~${approxTokens(bytes)} tokens`);
        void notifyLargeToolResult(name, bytes);
      }
    }
  }
}

function attachWatcher(filePath: string): void {
  const stat = fs.statSync(filePath);
  const state: WatcherState = {
    watcher: fs.watch(filePath, { persistent: false }, () => onFileChange()),
    filePath,
    position: stat.size,
    buffer: '',
    recentToolNames: new Map(),
  };
  active = state;
  out().appendLine(`[${new Date().toISOString()}] Watching ${filePath}`);

  function onFileChange(): void {
    if (!active || active.filePath !== filePath) { return; }
    let cur: fs.Stats;
    try { cur = fs.statSync(filePath); } catch { return; }
    if (cur.size < active.position) {
      // Truncated/rotated — restart from new EOF.
      active.position = cur.size;
      active.buffer = '';
      return;
    }
    if (cur.size === active.position) { return; }
    const fd = fs.openSync(filePath, 'r');
    try {
      const len = cur.size - active.position;
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, active.position);
      active.position = cur.size;
      processNewLines(active, buf.toString('utf-8'));
    } finally {
      fs.closeSync(fd);
    }
  }
}

export function startWatcher(silent = false): void {
  stopWatcher(true);
  const file = findActiveEventsFile();
  if (!file) {
    if (!silent) {
      void vscode.window.showWarningMessage(
        'Promptimizer Watcher: no Copilot CLI session found at ~/.copilot/session-state. Start a Copilot CLI session and run this command again.',
      );
    }
    return;
  }
  try {
    attachWatcher(file);
    if (!silent) {
      void vscode.window.showInformationMessage(
        `Promptimizer Watcher started — will warn on tool results > ${vscode.workspace.getConfiguration('copilotEnabler.promptimizer').get<number>('largeToolResultTokens', 3000)} tokens.`,
      );
    }
  } catch (err) {
    if (!silent) {
      void vscode.window.showErrorMessage(`Promptimizer Watcher failed to start: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export function stopWatcher(silent = false): void {
  if (active) {
    try { active.watcher.close(); } catch { /* ignore */ }
    out().appendLine(`[${new Date().toISOString()}] Stopped watching ${active.filePath}`);
    active = undefined;
    if (!silent) {
      void vscode.window.showInformationMessage('Promptimizer Watcher stopped.');
    }
  } else if (!silent) {
    void vscode.window.showInformationMessage('Promptimizer Watcher was not running.');
  }
}

export function isWatcherActive(): boolean {
  return active !== undefined;
}

/** Auto-start when the user has opted-in. */
export function autoStartIfEnabled(): void {
  const enabled = vscode.workspace.getConfiguration('copilotEnabler.promptimizer')
    .get<boolean>('watchOnStartup', false);
  if (enabled) { startWatcher(true); }
}
