import { detectHintsInText, analyzeLogs, readLogFiles, getWorkspaceStorageDebugLogPaths, MAX_LOG_BYTES, MAX_ENTRIES, LOG_MTIME_CUTOFF_MS, MAX_WORKSPACE_STORAGE_DIRS } from '../core/scanner/logs';
import type { LogEntry } from '../core/scanner/logs';
import { randomUUID } from 'crypto';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

describe('Scanner - Logs', () => {
  describe('detectHintsInText', () => {
    test('detects known hints in text', () => {
      const hints = new Map<string, boolean>();
      detectHintsInText('user activated agent mode for their project', hints);
      expect(hints.get('agent mode')).toBe(true);
    });

    test('detects multiple hints', () => {
      const hints = new Map<string, boolean>();
      detectHintsInText('used @workspace and @terminal participants with inline chat', hints);
      expect(hints.get('@workspace')).toBe(true);
      expect(hints.get('@terminal')).toBe(true);
      expect(hints.get('inline chat')).toBe(true);
    });

    test('does not detect non-matching text', () => {
      const hints = new Map<string, boolean>();
      detectHintsInText('just a regular log line with nothing special', hints);
      expect(hints.size).toBe(0);
    });

    test('detects file-related hints', () => {
      const hints = new Map<string, boolean>();
      detectHintsInText('found copilot-instructions.md and .prompt.md files', hints);
      expect(hints.get('copilot-instructions.md')).toBe(true);
      expect(hints.get('.prompt.md')).toBe(true);
    });

    test('detects MCP hints', () => {
      const hints = new Map<string, boolean>();
      detectHintsInText('configured mcp server in mcp.json', hints);
      expect(hints.get('mcp.json')).toBe(true);
      expect(hints.get('mcp server')).toBe(true);
    });
  });
});

describe('Scanner - analyzeLogs (debug log format)', () => {
  test('counts llm_request tokens from debug log entries', () => {
    const entries: LogEntry[] = [
      {
        timestamp: new Date(1776510449666).toISOString(),
        level: 'info',
        message: 'chat:claude-sonnet-4.6',
        data: { type: 'llm_request', name: 'chat:claude-sonnet-4.6', dur: 4951, inputTokens: 16818, outputTokens: 341 },
      },
      {
        timestamp: new Date(1776510453000).toISOString(),
        level: 'info',
        message: 'chat:claude-sonnet-4.6',
        data: { type: 'llm_request', name: 'chat:claude-sonnet-4.6', dur: 3104, inputTokens: 17538, outputTokens: 174 },
      },
    ];
    const summary = analyzeLogs(entries);
    expect(summary.llmRequests).toBe(2);
    expect(summary.totalInputTokens).toBe(34356);
    expect(summary.totalOutputTokens).toBe(515);
    expect(summary.hasVSCodeLogs).toBe(false);
  });

  test('does not count non-llm_request entries as llm requests', () => {
    const entries: LogEntry[] = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'tool_call',
        data: { type: 'tool_call', name: 'run_in_terminal', dur: 163 },
      },
    ];
    const summary = analyzeLogs(entries);
    expect(summary.llmRequests).toBe(0);
    expect(summary.totalInputTokens).toBe(0);
    expect(summary.totalOutputTokens).toBe(0);
    expect(summary.hasVSCodeLogs).toBe(false);
  });

  test('sets hasVSCodeLogs when entry source is outside workspaceStorage', () => {
    const entries: LogEntry[] = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'copilot log line',
        source: '/Users/test/Library/Application Support/Code/logs/copilot.log',
      },
    ];
    const summary = analyzeLogs(entries);
    expect(summary.hasVSCodeLogs).toBe(true);
    expect(summary.llmRequests).toBe(0);
  });
});

describe('Scanner - readLogFiles bounds', () => {
  let tmpDir: string;
  let createdWorkspaceDirs: string[];

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ce-scan-'));
    createdWorkspaceDirs = [];
  });

  afterEach(async () => {
    for (const workspaceDir of createdWorkspaceDirs) {
      await fsp.rm(workspaceDir, { recursive: true, force: true });
    }
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  function workspaceStorageBase(homeDir: string): string | undefined {
    switch (process.platform) {
      case 'win32': {
        const appData = process.env['APPDATA'];
        return appData ? path.join(appData, 'Code', 'User', 'workspaceStorage') : undefined;
      }
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
      case 'linux':
        return path.join(homeDir, '.config', 'Code', 'User', 'workspaceStorage');
      default:
        return undefined;
    }
  }

  test('skips files older than the mtime cutoff', async () => {
    const oldFile = path.join(tmpDir, 'copilot-old.log');
    const freshFile = path.join(tmpDir, 'copilot-fresh.log');
    await fsp.writeFile(oldFile, JSON.stringify({ message: 'old' }) + '\n');
    await fsp.writeFile(freshFile, JSON.stringify({ message: 'fresh' }) + '\n');

    const ancient = (Date.now() - LOG_MTIME_CUTOFF_MS - 60_000) / 1000;
    await fsp.utimes(oldFile, ancient, ancient);

    const entries: LogEntry[] = [];
    await readLogFiles(tmpDir, entries);
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('fresh');
  });

  test('tail-reads files larger than MAX_LOG_BYTES and discards partial first line', async () => {
    const big = path.join(tmpDir, 'copilot-big.log');
    // Build a file that exceeds the cap. First half is junk we expect to be dropped.
    const filler = 'x'.repeat(MAX_LOG_BYTES);
    const tailLines = ['', JSON.stringify({ message: 'tail-line-1' }), JSON.stringify({ message: 'tail-line-2' })].join('\n');
    await fsp.writeFile(big, filler + '\n' + tailLines);

    const entries: LogEntry[] = [];
    await readLogFiles(tmpDir, entries);
    const messages = entries.map(e => e.message);
    expect(messages).toEqual(expect.arrayContaining(['tail-line-1', 'tail-line-2']));
    // The filler line should NOT be present as a single huge entry.
    expect(messages.some(m => m.length >= MAX_LOG_BYTES)).toBe(false);
  });

  test('respects MAX_ENTRIES cap and signals stop', async () => {
    // Write more than MAX_ENTRIES lines into a single file
    const file = path.join(tmpDir, 'copilot-flood.log');
    const lines: string[] = [];
    const overflow = MAX_ENTRIES + 50;
    for (let i = 0; i < overflow; i++) {
      lines.push(JSON.stringify({ message: `m${i}` }));
    }
    await fsp.writeFile(file, lines.join('\n'));

    const entries: LogEntry[] = [];
    const stopped = await readLogFiles(tmpDir, entries);
    expect(stopped).toBe(true);
    expect(entries.length).toBe(MAX_ENTRIES);
  });

  test('ignores non-copilot files', async () => {
    await fsp.writeFile(path.join(tmpDir, 'random.log'), JSON.stringify({ message: 'nope' }));
    await fsp.writeFile(path.join(tmpDir, 'copilot-yes.log'), JSON.stringify({ message: 'yes' }));
    const entries: LogEntry[] = [];
    await readLogFiles(tmpDir, entries);
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('yes');
  });

  test('limits workspaceStorage debug-log scanning to the newest directories', async () => {
    const storageBase = workspaceStorageBase(os.homedir());
    if (!storageBase) {
      return;
    }

    await fsp.mkdir(storageBase, { recursive: true });

    const totalDirs = MAX_WORKSPACE_STORAGE_DIRS + 2;
    const newestWorkspaceNames: string[] = [];
    const runId = randomUUID();
    for (let i = 0; i < totalDirs; i++) {
      const workspaceName = `ce-scan-ws-${process.pid}-${runId}-${i}`;
      const workspaceDir = path.join(storageBase, workspaceName);
      const debugLogsDir = path.join(workspaceDir, 'GitHub.copilot-chat', 'debug-logs');
      await fsp.mkdir(debugLogsDir, { recursive: true });
      createdWorkspaceDirs.push(workspaceDir);
      const mtime = new Date(Date.now() + i * 1_000);
      await fsp.utimes(workspaceDir, mtime, mtime);
      if (i >= totalDirs - MAX_WORKSPACE_STORAGE_DIRS) {
        newestWorkspaceNames.unshift(workspaceName);
      }
    }

    const paths = await getWorkspaceStorageDebugLogPaths();
    const matchingPaths = paths.filter(p => createdWorkspaceDirs.some(dir => p.startsWith(dir)));

    expect(matchingPaths).toHaveLength(MAX_WORKSPACE_STORAGE_DIRS);
    expect(matchingPaths.map(p => path.basename(path.dirname(path.dirname(p))))).toEqual(newestWorkspaceNames);
  });
});
