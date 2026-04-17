import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ingestJsonl } from '../core/promptimizer/ingest';

describe('Promptimizer - ingest (JSONL)', () => {
  test('parses a minimal Anthropic-style payload into session/turn/blocks', () => {
    const payload = {
      session_id: 's1',
      turn: 0,
      request: {
        model: 'claude-sonnet-4.6',
        system: [{ type: 'text', text: 'You are helpful.' }],
        tools: [
          { name: 'github/search_issues', description: 'Search issues', input_schema: { type: 'object' } },
          { name: 'read_file', description: 'Read a file', input_schema: { type: 'object' } },
        ],
        messages: [
          { role: 'user', content: 'Hello!' },
          { role: 'assistant', content: [{ type: 'text', text: 'Hi there.' }] },
        ],
      },
    };
    const file = path.join(os.tmpdir(), `promptimizer-ingest-${Date.now()}.jsonl`);
    fs.writeFileSync(file, JSON.stringify(payload) + '\n', 'utf-8');

    try {
      const sessions = ingestJsonl(file);
      expect(sessions).toHaveLength(1);
      const s = sessions[0];
      expect(s.session_id).toBe('s1');
      expect(s.model).toBe('claude-sonnet-4.6');
      expect(s.turns).toHaveLength(1);

      const blocks = s.turns[0].blocks;
      expect(blocks.some((b) => b.category === 'system')).toBe(true);
      expect(blocks.some((b) => b.category === 'mcp_tool' && b.server === 'github')).toBe(true);
      expect(blocks.some((b) => b.category === 'built_in_tool' && b.name === 'read_file')).toBe(true);
      expect(blocks.some((b) => b.category === 'user_message')).toBe(true);
      expect(blocks.some((b) => b.category === 'assistant_message')).toBe(true);
    } finally {
      fs.unlinkSync(file);
    }
  });

  test('groups lines without an explicit session_id under the file name', () => {
    const p1 = { request: { model: 'claude-opus-4.7', system: 'A', messages: [{ role: 'user', content: 'x' }] } };
    const p2 = { request: { model: 'claude-opus-4.7', system: 'A', messages: [{ role: 'user', content: 'y' }] } };
    const file = path.join(os.tmpdir(), `promptimizer-ingest-group-${Date.now()}.jsonl`);
    fs.writeFileSync(file, `${JSON.stringify(p1)}\n${JSON.stringify(p2)}\n`, 'utf-8');
    try {
      const sessions = ingestJsonl(file);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].turns).toHaveLength(2);
      expect(sessions[0].turns[0].turn).toBe(0);
      expect(sessions[0].turns[1].turn).toBe(1);
    } finally {
      fs.unlinkSync(file);
    }
  });

  test('throws on malformed JSON lines', () => {
    const file = path.join(os.tmpdir(), `promptimizer-bad-${Date.now()}.jsonl`);
    fs.writeFileSync(file, 'not json\n', 'utf-8');
    try {
      expect(() => ingestJsonl(file)).toThrow(/malformed JSON/);
    } finally {
      fs.unlinkSync(file);
    }
  });
});

describe('Promptimizer - ingest (log entries)', () => {
  test('converts scanner LogEntry[] with Anthropic payload in data into sessions', () => {
    const { ingestFromLogEntries } = require('../core/promptimizer/ingest');
    const payload = {
      model: 'claude-sonnet-4.6',
      system: 'sys',
      tools: [{ name: 't', description: 'd', input_schema: {} }],
      messages: [{ role: 'user', content: 'hi' }],
    };
    const entries = [
      { timestamp: 'x', level: 'info', message: 'msg', source: '/tmp/Code/logs/20250417/exthost/GitHub.copilot-chat/prompts.log', data: payload },
      { timestamp: 'x', level: 'info', message: 'noise', source: '/tmp/noise.log', data: { foo: 'bar' } },
      { timestamp: 'x', level: 'info', message: JSON.stringify({ request: payload }), source: '/tmp/Code/logs/20250417/exthost/GitHub.copilot-chat/prompts2.log' },
    ];
    const sessions = ingestFromLogEntries(entries);
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    const turns = sessions.flatMap((s: { turns: unknown[] }) => s.turns);
    expect(turns.length).toBe(2);
    expect(turns[0].blocks.some((b: { category: string }) => b.category === 'system')).toBe(true);
  });

  test('returns empty array when no entries contain prompt payloads', () => {
    const { ingestFromLogEntries } = require('../core/promptimizer/ingest');
    const sessions = ingestFromLogEntries([
      { message: 'plain log', data: { foo: 1 }, source: '/tmp/x.log' },
    ]);
    expect(sessions).toEqual([]);
  });
});

describe('Promptimizer - ingest (Copilot CLI sessions)', () => {
  test('reconstructs turns from events.jsonl with session context propagated across turns', () => {
    const { ingestCopilotSessions } = require('../core/promptimizer/ingest');
    const tmp = path.join(os.tmpdir(), `promptimizer-sessions-${Date.now()}`);
    const sid = 'abc-123';
    const dir = path.join(tmp, sid);
    fs.mkdirSync(dir, { recursive: true });
    const events = [
      { type: 'session.start', data: { sessionId: sid, context: { cwd: '/repo', branch: 'main' } } },
      { type: 'session.model_change', data: { newModel: 'claude-opus-4.7' } },
      { type: 'user.message', data: { content: 'Hello' } },
      { type: 'assistant.message', data: { content: 'Hi!', toolRequests: [{ name: 'view', arguments: { path: '/a' } }] } },
      { type: 'tool.execution_complete', data: { toolName: 'view', result: { content: 'file contents' } } },
      { type: 'user.message', data: { content: 'Thanks' } },
      { type: 'assistant.message', data: { content: 'Welcome' } },
    ];
    fs.writeFileSync(path.join(dir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const origHome = process.env.HOME;
    process.env.HOME = tmp.replace(/\/\.copilot\/.*$/, '');
    // Redirect os.homedir via HOME — ingestCopilotSessions reads from os.homedir()/.copilot/session-state.
    // Build expected structure by symlinking.
    const fakeHome = path.join(tmp, 'home');
    const sessionRoot = path.join(fakeHome, '.copilot', 'session-state', sid);
    fs.mkdirSync(sessionRoot, { recursive: true });
    fs.copyFileSync(path.join(dir, 'events.jsonl'), path.join(sessionRoot, 'events.jsonl'));
    process.env.HOME = fakeHome;

    try {
      const os = require('os');
      jest.spyOn(os, 'homedir').mockReturnValue(fakeHome);
      const sessions = ingestCopilotSessions();
      const ours = sessions.find((s: { session_id: string }) => s.session_id.endsWith(sid));
      expect(ours).toBeDefined();
      expect(ours.model).toBe('claude-opus-4.7');
      expect(ours.turns.length).toBe(2);
      // Every turn should carry the system context block
      for (const t of ours.turns) {
        expect(t.blocks.some((b: { category: string }) => b.category === 'system')).toBe(true);
      }
      // Turn 0 should have user + assistant + tool_result
      const cats0 = ours.turns[0].blocks.map((b: { category: string }) => b.category);
      expect(cats0).toEqual(expect.arrayContaining(['system', 'user_message', 'assistant_message', 'tool_result']));
      // Friendly label derived from cwd + first prompt (no repository in this fixture)
      expect(ours.label).toBeDefined();
      expect(ours.label).toContain('repo');
      expect(ours.label).toContain('Hello');
      expect(ours.firstPrompt).toBe('Hello');
      expect(ours.context).toEqual(expect.objectContaining({ cwd: '/repo', branch: 'main' }));
    } finally {
      jest.restoreAllMocks();
      process.env.HOME = origHome;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('ingestCopilotHistorySessions reads history-session-state/*.json with chatMessages', () => {
    const { ingestCopilotHistorySessions } = require('../core/promptimizer/ingest');
    const tmp = path.join(os.tmpdir(), `promptimizer-history-${Date.now()}`);
    const root = path.join(tmp, '.copilot', 'history-session-state');
    fs.mkdirSync(root, { recursive: true });
    const body = {
      sessionId: 'hhh',
      startTime: '2025-10-08T21:10:16.398Z',
      chatMessages: [
        { role: 'user', content: 'please add mcp servers' },
        { role: 'assistant', content: 'sure' },
        {
          role: 'assistant',
          tool_calls: [
            { function: { name: 'str_replace_editor', arguments: '{"command":"view","path":"/x"}' } },
          ],
        },
        { role: 'tool', name: 'str_replace_editor', content: 'file contents here' },
        { role: 'user', content: 'thanks' },
      ],
    };
    fs.writeFileSync(path.join(root, 'session_hhh_1.json'), JSON.stringify(body));

    try {
      const osMod = require('os');
      jest.spyOn(osMod, 'homedir').mockReturnValue(tmp);
      const sessions = ingestCopilotHistorySessions();
      expect(sessions.length).toBe(1);
      const s = sessions[0];
      expect(s.session_id).toBe('copilot-history:hhh');
      expect(s.turns.length).toBe(2);
      const cats0 = s.turns[0].blocks.map((b: { category: string }) => b.category);
      expect(cats0).toEqual(expect.arrayContaining(['user_message', 'assistant_message', 'tool_result']));
      expect(s.firstPrompt).toContain('mcp');
    } finally {
      jest.restoreAllMocks();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

