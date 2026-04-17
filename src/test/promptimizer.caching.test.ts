import { computeStability } from '../core/promptimizer/diff';
import { runCachingRules } from '../core/promptimizer/recommend/caching';
import { tokenizeBlocks, HeuristicTokenizer } from '../core/promptimizer/tokenize';
import { Block, Finding, IngestedSession, IngestedTurn } from '../core/promptimizer/types';

const tok = new HeuristicTokenizer();

function bigText(n: number): string {
  return 'x'.repeat(n);
}

function turn(idx: number, blocks: Block[]): IngestedTurn {
  return {
    session_id: 'S',
    turn: idx,
    blocks: blocks.map((b) => ({ ...b })),
  };
}

function buildSession(turns: IngestedTurn[]): IngestedSession {
  const s: IngestedSession = { session_id: 'S', turns };
  for (const t of s.turns) { tokenizeBlocks(t.blocks, tok); }
  computeStability([s]);
  return s;
}

function assertFindingShape(f: Finding): void {
  expect(typeof f.rule).toBe('string');
  expect(['caching', 'authoring', 'hygiene', 'compression']).toContain(f.category);
  expect(Array.isArray(f.evidence.blocks)).toBe(true);
  expect(typeof f.estimated_savings.tokens_per_turn).toBe('number');
  expect(typeof f.estimated_savings.usd_per_100_turns).toBe('number');
  expect(typeof f.estimated_savings.input_token_share_after).toBe('number');
  expect(['none', 'low', 'medium', 'high']).toContain(f.quality_risk);
  expect(typeof f.auto_applicable).toBe('boolean');
  if (f.patch) { expect(typeof f.patch.type).toBe('string'); }
}

describe('Promptimizer - caching rules R-C1..R-C5', () => {
  test('R-C1 triggers on a stable >1024-token system+tools prefix across 3 turns', () => {
    // 5000-char system ~= 1250 tokens
    const stableBlocks = (u: string): Block[] => [
      { id: 'sys-0', category: 'system', text: bigText(5000) },
      { id: 'tool-0-gh/search', category: 'mcp_tool', server: 'github', name: 'gh/search', text: bigText(200) },
      { id: 'msg-u', category: 'user_message', text: u },
    ];
    const session = buildSession([turn(0, stableBlocks('a')), turn(1, stableBlocks('b')), turn(2, stableBlocks('c'))]);

    const findings = runCachingRules([session], 'claude-sonnet-4.6');
    const rc1 = findings.find((f) => f.rule === 'R-C1');
    expect(rc1).toBeDefined();
    assertFindingShape(rc1!);
    expect(rc1!.evidence.blocks).toContain('sys-0');
    expect(rc1!.evidence.blocks).toContain('tool-0-gh/search');
    expect(rc1!.estimated_savings.usd_per_100_turns).toBeGreaterThan(0);
    expect(rc1!.patch?.type).toBe('insert_cache_control');
  });

  test('R-C2 recommends 1h TTL when an idle gap >5min is observed', () => {
    const sys: Block = { id: 'sys-0', category: 'system', text: bigText(5000), cache_control: { type: 'ephemeral', ttl: '5m' } };
    const msg = (u: string): Block => ({ id: 'msg-u', category: 'user_message', text: u });

    const t0: IngestedTurn = { session_id: 'S', turn: 0, blocks: [sys, msg('a')] };
    const t1: IngestedTurn = { session_id: 'S', turn: 1, blocks: [sys, msg('b')] };
    (t0 as IngestedTurn & { timestamp: number }).timestamp = 0;
    (t1 as IngestedTurn & { timestamp: number }).timestamp = 10 * 60 * 1000; // 10 minutes later
    const session = buildSession([t0, t1]);

    const findings = runCachingRules([session], 'claude-sonnet-4.6');
    const rc2 = findings.find((f) => f.rule === 'R-C2');
    expect(rc2).toBeDefined();
    assertFindingShape(rc2!);
    expect(rc2!.patch?.ttl).toBe('1h');
  });

  test('R-C3 suggests a second breakpoint after a stable history/summary block', () => {
    const prefix: Block = { id: 'sys-0', category: 'system', text: bigText(5000), cache_control: { type: 'ephemeral', ttl: '5m' } };
    const summary: Block = { id: 'summary', category: 'assistant_message', text: bigText(6000) };
    const live = (u: string): Block => ({ id: `live-${u}`, category: 'user_message', text: u });

    const session = buildSession([
      turn(0, [prefix, summary, live('a')]),
      turn(1, [prefix, summary, live('b')]),
      turn(2, [prefix, summary, live('c')]),
    ]);

    const findings = runCachingRules([session], 'claude-sonnet-4.6');
    const rc3 = findings.find((f) => f.rule === 'R-C3');
    expect(rc3).toBeDefined();
    assertFindingShape(rc3!);
    expect(rc3!.evidence.blocks).toContain('summary');
    expect(rc3!.patch?.type).toBe('insert_cache_control');
  });

  test('R-C4 fires when a churning block sits between two stable blocks', () => {
    const stableA: Block = { id: 'A', category: 'system', text: 'aaaa' };
    const stableC: Block = { id: 'C', category: 'custom_instruction', text: 'cccc' };
    const churn = (t: string): Block => ({ id: 'B', category: 'skill', text: t });

    const session = buildSession([
      turn(0, [stableA, churn('one'), stableC]),
      turn(1, [stableA, churn('two'), stableC]),
    ]);

    const findings = runCachingRules([session], 'claude-sonnet-4.6');
    const rc4 = findings.find((f) => f.rule === 'R-C4');
    expect(rc4).toBeDefined();
    assertFindingShape(rc4!);
    expect(rc4!.evidence.blocks).toEqual(['A', 'B', 'C']);
    expect(rc4!.patch?.type).toBe('move_block_after_breakpoint');
  });

  test('R-C5 warns when >20 blocks accumulate past the last breakpoint', () => {
    const cached: Block = { id: 'sys-0', category: 'system', text: bigText(2000), cache_control: { type: 'ephemeral', ttl: '5m' } };
    const extras: Block[] = [];
    for (let i = 0; i < 25; i++) {
      extras.push({ id: `m-${i}`, category: 'user_message', text: `hello ${i}` });
    }
    const session = buildSession([turn(0, [cached, ...extras]), turn(1, [cached, ...extras])]);

    const findings = runCachingRules([session], 'claude-sonnet-4.6');
    const rc5 = findings.find((f) => f.rule === 'R-C5');
    expect(rc5).toBeDefined();
    assertFindingShape(rc5!);
    expect(rc5!.patch?.type).toBe('insert_cache_control');
    expect((rc5!.evidence as { added_blocks?: number }).added_blocks).toBe(25);
  });
});
