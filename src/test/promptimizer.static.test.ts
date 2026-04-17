import * as path from 'path';
import {
  findDuplicatePairs,
  ruleFluffPhrases,
  ruleFewShotOverload,
  ruleRuleBloat,
} from '../core/promptimizer/staticScan';
import { StaticFinding } from '../core/promptimizer/types';

// ──────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────────────────────────────────────

const FIXTURE_PATH = '/workspace/.github/copilot-instructions.md';

function assertStaticFindingShape(f: StaticFinding): void {
  expect(typeof f.rule).toBe('string');
  expect(['authoring', 'hygiene', 'compression']).toContain(f.category);
  expect(typeof f.file).toBe('string');
  expect(['none', 'low', 'medium', 'high']).toContain(f.quality_risk);
  expect(typeof f.message).toBe('string');
  expect(f.message.length).toBeGreaterThan(0);
}

// ──────────────────────────────────────────────────────────────────────────────
// S-FP1 — Performative Fluff
// ──────────────────────────────────────────────────────────────────────────────

describe('S-FP1 — Performative Fluff', () => {
  test('fires when persona framing is present', () => {
    const content = `# Instructions\n\nYou are a world-class TypeScript engineer.\n\nAlways write clean code.`;
    const result = ruleFluffPhrases(FIXTURE_PATH, content);
    expect(result).toBeDefined();
    assertStaticFindingShape(result!);
    expect(result!.rule).toBe('S-FP1');
    expect(result!.category).toBe('authoring');
    expect(result!.quality_risk).toBe('low');
    expect(result!.line).toBe(3);
    expect(result!.evidence.count).toBe(1);
    expect(Array.isArray(result!.evidence.lines)).toBe(true);
  });

  test('fires for "please could you" framing', () => {
    const content = `Please could you always respond in JSON.`;
    const result = ruleFluffPhrases(FIXTURE_PATH, content);
    expect(result).toBeDefined();
    expect(result!.rule).toBe('S-FP1');
  });

  test('fires for "think carefully before" phrasing', () => {
    const content = `Think carefully before making any changes to the schema.`;
    const result = ruleFluffPhrases(FIXTURE_PATH, content);
    expect(result).toBeDefined();
  });

  test('counts multiple fluff lines', () => {
    const content = [
      'You are a senior expert engineer.',
      'Think deeply about the problem before answering.',
      'Act as a genius developer.',
    ].join('\n');
    const result = ruleFluffPhrases(FIXTURE_PATH, content);
    expect(result).toBeDefined();
    expect(result!.evidence.count).toBe(3);
  });

  test('does not fire on clean structural instructions', () => {
    const content = `# Instructions\n\n- Output only the modified code block.\n- Do not use \`any\`.\n- Use strict ES2022 TypeScript.`;
    const result = ruleFluffPhrases(FIXTURE_PATH, content);
    expect(result).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// S-RB1 — Rule Bloat
// ──────────────────────────────────────────────────────────────────────────────

describe('S-RB1 — Rule Bloat', () => {
  function makeBullets(count: number): string {
    return Array.from({ length: count }, (_, i) => `- Rule ${i + 1}: do the thing correctly.`).join('\n');
  }

  test('fires when bullet count exceeds 25', () => {
    const content = makeBullets(30);
    const result = ruleRuleBloat(FIXTURE_PATH, content);
    expect(result).toBeDefined();
    assertStaticFindingShape(result!);
    expect(result!.rule).toBe('S-RB1');
    expect(result!.evidence.count).toBe(30);
    expect(result!.quality_risk).toBe('low');
  });

  test('does not fire at exactly 25 bullets', () => {
    const content = makeBullets(25);
    const result = ruleRuleBloat(FIXTURE_PATH, content);
    expect(result).toBeUndefined();
  });

  test('does not fire below threshold', () => {
    const content = makeBullets(10);
    const result = ruleRuleBloat(FIXTURE_PATH, content);
    expect(result).toBeUndefined();
  });

  test('counts * and + bullets as well as -', () => {
    const stars = Array.from({ length: 20 }, (_, i) => `* Rule ${i}: prefer const over let.`).join('\n');
    const plusses = Array.from({ length: 10 }, (_, i) => `+ Rule ${i}: avoid any.`).join('\n');
    const result = ruleRuleBloat(FIXTURE_PATH, `${stars}\n${plusses}`);
    expect(result).toBeDefined();
    expect(result!.evidence.count).toBe(30);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// S-FS1 — Few-Shot Overload
// ──────────────────────────────────────────────────────────────────────────────

describe('S-FS1 — Few-Shot Overload', () => {
  function makeFences(count: number, bodyLength = 200): string {
    return Array.from({ length: count }, (_, i) => `\`\`\`ts\nconst x${i} = ${'a'.repeat(bodyLength)};\n\`\`\``).join('\n\n');
  }

  test('fires with ≥3 code-fence pairs and >800 estimated tokens', () => {
    const content = makeFences(4, 1000); // ~4 examples, ~1000 chars each → >800 tokens
    const result = ruleFewShotOverload(FIXTURE_PATH, content);
    expect(result).toBeDefined();
    assertStaticFindingShape(result!);
    expect(result!.rule).toBe('S-FS1');
    expect(result!.evidence.fenceCount).toBe(4);
    expect(result!.quality_risk).toBe('medium');
  });

  test('does not fire with fewer than 3 fence pairs', () => {
    const content = makeFences(2, 500);
    const result = ruleFewShotOverload(FIXTURE_PATH, content);
    expect(result).toBeUndefined();
  });

  test('does not fire when token count is below threshold regardless of fence count', () => {
    // 3 fences but very short bodies → <800 tokens
    const content = makeFences(3, 5);
    const result = ruleFewShotOverload(FIXTURE_PATH, content);
    expect(result).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// S-DED1 — Cross-File Deduplication
// ──────────────────────────────────────────────────────────────────────────────

describe('S-DED1 — Cross-File Deduplication', () => {
  const PARA_A = 'Always use strict TypeScript. Avoid any implicit any types in all new files added to the codebase.';
  const PARA_B = 'Prefer const over let. Never use var. Keep declarations at the narrowest possible scope always.';
  const PARA_C = 'Write unit tests for all public functions. Mock VS Code APIs using jest.mock with virtual modules.';
  const PARA_UNIQUE = 'This is a completely different paragraph about agent mode configuration and its distinct settings.';

  function makeContent(...paras: string[]): string {
    return paras.join('\n\n');
  }

  test('detects high-overlap file pairs', () => {
    const files = [
      { path: '/ws/.github/copilot-instructions.md', content: makeContent(PARA_A, PARA_B, PARA_C) },
      { path: '/ws/.github/instructions/agent.instructions.md', content: makeContent(PARA_A, PARA_B, PARA_C) },
    ];
    const pairs = findDuplicatePairs(files);
    expect(pairs.length).toBe(1);
    expect(pairs[0].fileA).toBe(files[0].path);
    expect(pairs[0].fileB).toBe(files[1].path);
    expect(pairs[0].similarity).toBeGreaterThanOrEqual(0.75);
    expect(pairs[0].sharedParagraphs).toBe(3);
  });

  test('does not flag files with low overlap', () => {
    const files = [
      { path: '/ws/.github/copilot-instructions.md', content: makeContent(PARA_A, PARA_B, PARA_C) },
      { path: '/ws/.github/instructions/agent.instructions.md', content: makeContent(PARA_UNIQUE, 'Second unique para that is completely different from everything else above.', 'Third completely unrelated paragraph with no overlap at all with the prior file.') },
    ];
    const pairs = findDuplicatePairs(files);
    expect(pairs.length).toBe(0);
  });

  test('ignores files with fewer than 3 paragraphs', () => {
    const files = [
      { path: '/ws/.github/copilot-instructions.md', content: makeContent(PARA_A, PARA_B, PARA_C) },
      { path: '/ws/.github/prompts/short.prompt.md', content: PARA_A }, // only 1 paragraph
    ];
    const pairs = findDuplicatePairs(files);
    expect(pairs.length).toBe(0);
  });

  test('handles partial overlap correctly', () => {
    // 4th para must be >80 chars to enter the set; Jaccard = 3/5 = 0.6 — below threshold.
    const uniqueParaB = 'Entirely different fourth paragraph discussing deployment pipelines and CI configuration with no overlap.';
    const files = [
      { path: '/ws/.github/copilot-instructions.md', content: makeContent(PARA_A, PARA_B, PARA_C, PARA_UNIQUE) },
      { path: '/ws/.github/instructions/edit.instructions.md', content: makeContent(PARA_A, PARA_B, PARA_C, uniqueParaB) },
    ];
    const pairs = findDuplicatePairs(files);
    // 3 shared out of 5 union (A:{4}, B:{4}) = 0.6 — below 0.75 threshold
    expect(pairs.length).toBe(0);
  });

  test('finding shape is valid for dedup output', () => {
    // Use path.join to build platform-correct paths
    const fileA = path.join('/ws', '.github', 'copilot-instructions.md');
    const fileB = path.join('/ws', '.github', 'instructions', 'agent.instructions.md');
    const files = [
      { path: fileA, content: makeContent(PARA_A, PARA_B, PARA_C) },
      { path: fileB, content: makeContent(PARA_A, PARA_B, PARA_C) },
    ];
    const pairs = findDuplicatePairs(files);
    expect(pairs.length).toBe(1);
    expect(typeof pairs[0].similarity).toBe('number');
    expect(typeof pairs[0].sharedParagraphs).toBe('number');
  });
});
