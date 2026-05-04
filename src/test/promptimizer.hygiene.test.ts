import { ruleFluff, ruleRuleBloat, ruleFewShot, runHygieneRules } from '../core/promptimizer/recommend/hygiene';
import { ruleDeduplication, runDeduplicationRules } from '../core/promptimizer/recommend/deduplication';
import { ruleMcpToolOverhead, ruleLostInMiddle } from '../core/promptimizer/recommend/general';
import { Block, Finding, IngestedSession, IngestedTurn } from '../core/promptimizer/types';

// ──────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4.6' as const;

function turn(idx: number, blocks: Block[]): IngestedTurn {
  return { session_id: 'S', turn: idx, blocks };
}

function session(turns: IngestedTurn[], id = 'S'): IngestedSession {
  return { session_id: id, turns };
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
}

// ──────────────────────────────────────────────────────────────────────────────
// R-FP1 — Performative Fluff
// ──────────────────────────────────────────────────────────────────────────────

describe('R-FP1 — Performative Fluff', () => {
  test('fires on custom_instruction block with persona framing', () => {
    const s = session([
      turn(0, [{
        id: 'ci-0',
        category: 'custom_instruction',
        text: 'You are a world-class TypeScript engineer. Always think carefully before writing code.',
        tokens: 250,
      }]),
    ]);
    const f = ruleFluff(s, MODEL);
    expect(f).toBeDefined();
    assertStaticShape(f!);
    expect(f!.rule).toBe('R-FP1');
    expect(f!.category).toBe('authoring');
    expect(f!.quality_risk).toBe('low');
    expect(f!.evidence.blocks).toContain('ci-0');
  });

  test('fires on skill blocks with qualitative adverbs', () => {
    const s = session([
      turn(0, [{ id: 'sk-0', category: 'skill', text: 'Please could you always respond with full context.', tokens: 200 }]),
    ]);
    const f = ruleFluff(s, MODEL);
    expect(f).toBeDefined();
    expect(f!.rule).toBe('R-FP1');
  });

  test('fires on system blocks', () => {
    const s = session([
      turn(0, [{ id: 'sys-0', category: 'system', text: 'Act as a genius developer and think deeply about the problem.', tokens: 300 }]),
    ]);
    const f = ruleFluff(s, MODEL);
    expect(f).toBeDefined();
  });

  test('does not fire on clean structural instructions', () => {
    const s = session([
      turn(0, [{ id: 'ci-0', category: 'custom_instruction', text: 'Output only the modified code block. Do not use `any`. Use strict ES2022 TypeScript.', tokens: 200 }]),
    ]);
    expect(ruleFluff(s, MODEL)).toBeUndefined();
  });

  test('does not fire on user_message or tool_result blocks', () => {
    const s = session([
      turn(0, [
        { id: 'u-0', category: 'user_message', text: 'You are a world-class engineer — help me.', tokens: 20 },
        { id: 'tr-0', category: 'tool_result', text: 'You are a world-class engineer.', tokens: 20 },
      ]),
    ]);
    expect(ruleFluff(s, MODEL)).toBeUndefined();
  });

  test('deduplicates the same block across turns', () => {
    // Same block ID appearing in multiple turns should only be counted once.
    const block: Block = { id: 'ci-stable', category: 'custom_instruction', text: 'You are a senior expert developer.', tokens: 200 };
    const s = session([turn(0, [block]), turn(1, [block]), turn(2, [block])]);
    const f = ruleFluff(s, MODEL);
    expect(f).toBeDefined();
    expect(f!.evidence.count).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// R-RB1 — Rule Bloat
// ──────────────────────────────────────────────────────────────────────────────

function makeBulletsBlock(id: string, count: number, category: 'custom_instruction' | 'system' = 'custom_instruction'): Block {
  const text = Array.from({ length: count }, (_, i) => `- Rule ${i + 1}: do the right thing.`).join('\n');
  return { id, category, text, tokens: count * 10 };
}

describe('R-RB1 — Rule Bloat', () => {
  test('fires when a custom_instruction block has >25 bullets', () => {
    const s = session([turn(0, [makeBulletsBlock('ci-0', 30)])]);
    const f = ruleRuleBloat(s, MODEL);
    expect(f).toBeDefined();
    assertStaticShape(f!);
    expect(f!.rule).toBe('R-RB1');
    expect(f!.evidence.max_bullet_count).toBe(30);
    expect(f!.quality_risk).toBe('low');
  });

  test('fires on system blocks too', () => {
    const s = session([turn(0, [makeBulletsBlock('sys-0', 26, 'system')])]);
    expect(ruleRuleBloat(s, MODEL)).toBeDefined();
  });

  test('does not fire at exactly 25 bullets', () => {
    const s = session([turn(0, [makeBulletsBlock('ci-0', 25)])]);
    expect(ruleRuleBloat(s, MODEL)).toBeUndefined();
  });

  test('does not fire on user_message blocks', () => {
    const text = Array.from({ length: 30 }, (_, i) => `- item ${i}`).join('\n');
    const s = session([turn(0, [{ id: 'u-0', category: 'user_message', text, tokens: 300 }])]);
    expect(ruleRuleBloat(s, MODEL)).toBeUndefined();
  });

  test('estimated savings are positive', () => {
    const s = session([turn(0, [makeBulletsBlock('ci-0', 50)])]);
    const f = ruleRuleBloat(s, MODEL);
    expect(f!.estimated_savings.usd_per_100_turns).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// R-FS1 — Few-Shot Overload
// ──────────────────────────────────────────────────────────────────────────────

function makeFewShotBlock(id: string, fenceCount: number, tokensVal: number, category: 'skill' | 'custom_instruction' = 'skill'): Block {
  const fences = Array.from({ length: fenceCount * 2 }, (_, i) =>
    i % 2 === 0 ? '```ts\nconst x = 1;\n' : '```',
  ).join('\n');
  return { id, category, text: fences, tokens: tokensVal };
}

describe('R-FS1 — Few-Shot Overload', () => {
  test('fires on skill block with ≥3 fence pairs and >800 tokens', () => {
    const s = session([turn(0, [makeFewShotBlock('sk-0', 4, 1200)])]);
    const f = ruleFewShot(s, MODEL);
    expect(f).toBeDefined();
    assertStaticShape(f!);
    expect(f!.rule).toBe('R-FS1');
    expect(f!.quality_risk).toBe('medium');
    expect(f!.evidence.max_fence_count).toBe(4);
  });

  test('fires on custom_instruction blocks', () => {
    const s = session([turn(0, [makeFewShotBlock('ci-0', 3, 900, 'custom_instruction')])]);
    expect(ruleFewShot(s, MODEL)).toBeDefined();
  });

  test('does not fire below token threshold', () => {
    const s = session([turn(0, [makeFewShotBlock('sk-0', 4, 500)])]);
    expect(ruleFewShot(s, MODEL)).toBeUndefined();
  });

  test('does not fire with fewer than 3 fence pairs', () => {
    const s = session([turn(0, [makeFewShotBlock('sk-0', 2, 1200)])]);
    expect(ruleFewShot(s, MODEL)).toBeUndefined();
  });

  test('estimated savings reflect 60% reduction assumption', () => {
    const tokens = 1000;
    const s = session([turn(0, [makeFewShotBlock('sk-0', 4, tokens)])]);
    const f = ruleFewShot(s, MODEL);
    expect(f!.estimated_savings.tokens_per_turn).toBe(600);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// runHygieneRules
// ──────────────────────────────────────────────────────────────────────────────

describe('runHygieneRules', () => {
  test('aggregates all three rule results across sessions', () => {
    const fluffSession = session([
      turn(0, [{ id: 'ci-0', category: 'custom_instruction', text: 'You are a world-class engineer.', tokens: 200 }]),
    ], 'S1');
    const bloatSession = session([
      turn(0, [makeBulletsBlock('ci-0', 30)]),
    ], 'S2');
    const findings = runHygieneRules([fluffSession, bloatSession], MODEL);
    expect(findings.length).toBeGreaterThanOrEqual(2);
    const rules = findings.map((f) => f.rule);
    expect(rules).toContain('R-FP1');
    expect(rules).toContain('R-RB1');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// R-DED1 — Context Deduplication
// ──────────────────────────────────────────────────────────────────────────────

// Generate a repetitive text of roughly `n` words to produce high bigram overlap.
function wordText(words: string, repeat: number): string {
  return Array(repeat).fill(words).join(' ');
}

describe('R-DED1 — Context Deduplication', () => {
  const sharedWords = 'always use strict typescript avoid any implicit types prefer const over let never use var keep code focused';

  test('fires when cross-category blocks share ≥75% bigram overlap', () => {
    const text = wordText(sharedWords, 8);
    const s = session([turn(0, [
      { id: 'sys-0', category: 'system', text, tokens: 300 },
      { id: 'ci-0', category: 'custom_instruction', text, tokens: 300 },
    ])]);
    const f = ruleDeduplication(s, MODEL);
    expect(f).toBeDefined();
    assertStaticShape(f!);
    expect(f!.rule).toBe('R-DED1');
    expect(f!.category).toBe('hygiene');
    expect(f!.quality_risk).toBe('medium');
    expect(f!.evidence.pairs).toBe(1);
    expect(f!.estimated_savings.tokens_per_turn).toBeGreaterThan(0);
  });

  test('does not fire when blocks have low overlap', () => {
    const s = session([turn(0, [
      { id: 'sys-0', category: 'system', text: wordText('typescript strict types interfaces generics', 8), tokens: 200 },
      { id: 'ci-0', category: 'custom_instruction', text: wordText('github pull request review workflow automation pipeline', 8), tokens: 200 },
    ])]);
    expect(ruleDeduplication(s, MODEL)).toBeUndefined();
  });

  test('does not fire when same-category blocks overlap (handled elsewhere)', () => {
    const text = wordText(sharedWords, 8);
    const s = session([turn(0, [
      { id: 'ci-0', category: 'custom_instruction', text, tokens: 300 },
      { id: 'ci-1', category: 'custom_instruction', text, tokens: 300 },
    ])]);
    // Same category → skipped by R-DED1.
    expect(ruleDeduplication(s, MODEL)).toBeUndefined();
  });

  test('does not fire on blocks below MIN_BLOCK_TOKENS', () => {
    const text = wordText(sharedWords, 8);
    const s = session([turn(0, [
      { id: 'sys-0', category: 'system', text, tokens: 50 },
      { id: 'ci-0', category: 'custom_instruction', text, tokens: 50 },
    ])]);
    expect(ruleDeduplication(s, MODEL)).toBeUndefined();
  });

  test('uses the last turn as representative', () => {
    const sharedText = wordText(sharedWords, 10);
    const uniqueText = wordText('agent mode subagent tools workflow automation pipeline deployment', 10);
    const s = session([
      // Turn 0: no overlap
      turn(0, [
        { id: 'sys-0', category: 'system', text: uniqueText, tokens: 200 },
        { id: 'ci-0', category: 'custom_instruction', text: uniqueText, tokens: 200 },
      ]),
      // Turn 1 (last): high overlap
      turn(1, [
        { id: 'sys-1', category: 'system', text: sharedText, tokens: 300 },
        { id: 'ci-1', category: 'custom_instruction', text: sharedText, tokens: 300 },
      ]),
    ]);
    const f = ruleDeduplication(s, MODEL);
    expect(f).toBeDefined();
    expect(f!.evidence.blocks).toContain('sys-1');
    expect(f!.evidence.blocks).toContain('ci-1');
  });

  test('runDeduplicationRules aggregates across sessions', () => {
    const text = wordText(sharedWords, 10);
    const s1 = session([turn(0, [
      { id: 'sys-0', category: 'system', text, tokens: 300 },
      { id: 'ci-0', category: 'custom_instruction', text, tokens: 300 },
    ])], 'S1');
    const s2 = session([turn(0, [])], 'S2');
    const findings = runDeduplicationRules([s1, s2], MODEL);
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe('R-DED1');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// R-MCP1 — Low-Return MCP Tool Overhead
// ──────────────────────────────────────────────────────────────────────────────

function mcpBlock(id: string, name: string, tokens: number): Block {
  return { id, category: 'mcp_tool', name, text: `description of ${name}`, tokens };
}

function userBlock(id: string): Block {
  return { id, category: 'user_message', text: 'do the thing', tokens: 10 };
}

function buildMcpSession(turnCount: number, includeCalled: boolean): IngestedSession {
  const turns: IngestedTurn[] = [];
  for (let i = 0; i < turnCount; i++) {
    const blocks: Block[] = [
      mcpBlock(`mcp-gh-${i}`, 'github/search', 600),
      userBlock(`u-${i}`),
    ];
    if (includeCalled && i === 0) {
      // Add a tool_result to simulate the tool being called on turn 0.
      blocks.push({ id: `tr-${i}`, category: 'tool_result', name: 'github/search', text: 'results', tokens: 50 });
    }
    turns.push(turn(i, blocks));
  }
  return session(turns);
}

describe('R-MCP1 — Low-Return MCP Tool Overhead', () => {
  test('fires when expensive MCP tool is loaded every turn but never called', () => {
    const s = buildMcpSession(5, false);
    const f = ruleMcpToolOverhead(s, MODEL);
    expect(f).toBeDefined();
    assertStaticShape(f!);
    expect(f!.rule).toBe('R-MCP1');
    expect(f!.category).toBe('hygiene');
    expect(f!.quality_risk).toBe('low');
    expect(f!.estimated_savings.usd_per_100_turns).toBeGreaterThan(0);
  });

  test('does not fire when MCP tool has a paired tool_result', () => {
    const s = buildMcpSession(5, true);
    expect(ruleMcpToolOverhead(s, MODEL)).toBeUndefined();
  });

  test('does not fire for sessions with fewer than 3 turns', () => {
    const s = buildMcpSession(2, false);
    expect(ruleMcpToolOverhead(s, MODEL)).toBeUndefined();
  });

  test('does not fire when tool tokens are below 500', () => {
    const turns = Array.from({ length: 5 }, (_, i) => turn(i, [
      { id: `mcp-${i}`, category: 'mcp_tool', name: 'cheap/tool', text: 'small', tokens: 100 },
      userBlock(`u-${i}`),
    ]));
    expect(ruleMcpToolOverhead(session(turns), MODEL)).toBeUndefined();
  });

  test('lists tool names in evidence', () => {
    const s = buildMcpSession(5, false);
    const f = ruleMcpToolOverhead(s, MODEL);
    expect(Array.isArray((f!.evidence as { tools?: string[] }).tools)).toBe(true);
    expect((f!.evidence as { tools?: string[] }).tools).toContain('github/search');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// R-LM1 — Lost-in-the-Middle Tool Accumulation
// ──────────────────────────────────────────────────────────────────────────────

function buildLMSession(opts: {
  turns: number;
  edgeToolTokens: number;
  midToolTokens: number;
}): IngestedSession {
  const { turns: n, edgeToolTokens, midToolTokens } = opts;
  const midStart = Math.floor(n * 0.25);
  const midEnd = Math.floor(n * 0.75);

  const turns: IngestedTurn[] = [];
  for (let i = 0; i < n; i++) {
    const isMid = i >= midStart && i < midEnd;
    const toolTokens = isMid ? midToolTokens : edgeToolTokens;
    turns.push(turn(i, [
      { id: `tool-${i}`, category: 'mcp_tool', name: 'tool', text: 'description', tokens: toolTokens },
      userBlock(`u-${i}`),
    ]));
  }
  return session(turns);
}

describe('R-LM1 — Lost-in-the-Middle Tool Accumulation', () => {
  test('fires when middle tool tokens exceed edge tokens in a long session', () => {
    // 16 turns: mid (turns 4-11 = 8 turns) × 2000 tokens = 16000 mid
    // edge (turns 0-3 + 12-15 = 8 turns) × 200 tokens = 1600 edge
    const s = buildLMSession({ turns: 16, edgeToolTokens: 200, midToolTokens: 2000 });
    const f = ruleLostInMiddle(s, MODEL);
    expect(f).toBeDefined();
    assertStaticShape(f!);
    expect(f!.rule).toBe('R-LM1');
    expect(f!.category).toBe('hygiene');
    expect(f!.quality_risk).toBe('medium');
    expect(f!.estimated_savings.usd_per_100_turns).toBeGreaterThan(0);
    expect((f!.evidence as { middle_tool_tokens?: number }).middle_tool_tokens).toBeGreaterThan(
      (f!.evidence as { edge_tool_tokens?: number }).edge_tool_tokens!,
    );
  });

  test('does not fire when edge tokens are larger', () => {
    const s = buildLMSession({ turns: 16, edgeToolTokens: 2000, midToolTokens: 200 });
    expect(ruleLostInMiddle(s, MODEL)).toBeUndefined();
  });

  test('does not fire for sessions below 12 turns', () => {
    const s = buildLMSession({ turns: 10, edgeToolTokens: 200, midToolTokens: 2000 });
    expect(ruleLostInMiddle(s, MODEL)).toBeUndefined();
  });

  test('does not fire when middle excess is trivially small', () => {
    // mid total < 1000 tokens minimum threshold
    const s = buildLMSession({ turns: 12, edgeToolTokens: 50, midToolTokens: 120 });
    expect(ruleLostInMiddle(s, MODEL)).toBeUndefined();
  });

  test('evidence includes turn count and token breakdown', () => {
    const s = buildLMSession({ turns: 16, edgeToolTokens: 200, midToolTokens: 2000 });
    const f = ruleLostInMiddle(s, MODEL);
    expect((f!.evidence as { turns?: number }).turns).toBe(16);
    expect(typeof (f!.evidence as { excess_tokens?: number }).excess_tokens).toBe('number');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Shared shape validator (avoids import of caching test helper)
// ──────────────────────────────────────────────────────────────────────────────

function assertStaticShape(f: Finding): void {
  assertFindingShape(f);
  if (f.patch) { expect(typeof f.patch.type).toBe('string'); }
}
