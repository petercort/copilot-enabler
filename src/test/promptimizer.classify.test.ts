import { classifyBlock, classifyBlocks } from '../core/promptimizer/classify';
import { Block, RawTurn } from '../core/promptimizer/types';

describe('Promptimizer - classify', () => {
  test('preserves a pre-set valid category', () => {
    const b: Block = { id: 'sys', category: 'system', text: 'hello' };
    expect(classifyBlock(b).category).toBe('system');
  });

  test('normalises aliases (instructions, user, tool)', () => {
    expect(classifyBlock({ id: 'c', category: 'instructions' as unknown as Block['category'], text: 'x' }).category).toBe('custom_instruction');
    expect(classifyBlock({ id: 'u', category: 'user' as unknown as Block['category'], text: 'x' }).category).toBe('user_message');
    expect(classifyBlock({ id: 't', category: 'tool' as unknown as Block['category'], text: 'x' }).category).toBe('built_in_tool');
  });

  test('splits MCP tools per server', () => {
    const turn: RawTurn = {
      session_id: 's', turn: 0,
      blocks: [
        { id: 't1', category: 'mcp_tool', text: 'a', server: 'github', name: 'search_issues' },
        { id: 't2', category: 'mcp_tool', text: 'b', server: 'filesystem', name: 'read_file' },
        { id: 't3', category: 'built_in_tool', text: 'c', name: 'bash' },
      ],
    };
    const blocks = classifyBlocks(turn);
    const servers = blocks.filter((b) => b.category === 'mcp_tool').map((b) => b.server).sort();
    expect(servers).toEqual(['filesystem', 'github']);
    expect(blocks.find((b) => b.id === 't3')?.category).toBe('built_in_tool');
  });

  test('throws when an mcp_tool has no server attribution', () => {
    const b: Block = { id: 'bad', category: 'mcp_tool', text: 'x' };
    expect(() => classifyBlock(b)).toThrow(/missing server attribution/);
  });

  test('falls back to meta.role when category is missing', () => {
    const b: Block = { id: 'm', category: '' as unknown as Block['category'], text: 'x', meta: { role: 'assistant' } };
    expect(classifyBlock(b).category).toBe('assistant_message');
  });
});
