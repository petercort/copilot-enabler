import { detectHintsInText, analyzeLogs } from '../core/scanner/logs';
import type { LogEntry } from '../core/scanner/logs';

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
  });
});
