import * as path from 'path';
import {
  findDuplicatePairs,
  ruleFluffPhrases,
  ruleFewShotOverload,
  ruleRuleBloat,
  ruleAlwaysOnBudget,
  ruleApplyToScope,
  ruleRetrievalPrecision,
  rulePromptCacheStability,
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

// ──────────────────────────────────────────────────────────────────────────────
// S-AOC1 — Always-On Context Budget
// ──────────────────────────────────────────────────────────────────────────────

describe('S-AOC1 — Always-On Context Budget', () => {
  test('fires when file exceeds 1500 token estimate', () => {
    // ~6000 chars → ~1500 tokens threshold; use 7000 chars to exceed it
    const content = 'a'.repeat(7000);
    const result = ruleAlwaysOnBudget(FIXTURE_PATH, content);
    expect(result).toBeDefined();
    assertStaticFindingShape(result!);
    expect(result!.rule).toBe('S-AOC1');
    expect(result!.category).toBe('compression');
    expect(result!.quality_risk).toBe('medium');
    expect(result!.evidence.tokens).toBeGreaterThan(1500);
  });

  test('does not fire for small files', () => {
    const content = 'Short instruction file.\n'.repeat(10);
    const result = ruleAlwaysOnBudget(FIXTURE_PATH, content);
    expect(result).toBeUndefined();
  });

  test('does not fire at exactly the threshold', () => {
    // exactly 6000 chars → exactly 1500 tokens → should not fire (<=)
    const content = 'a'.repeat(6000);
    const result = ruleAlwaysOnBudget(FIXTURE_PATH, content);
    expect(result).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// S-ASC1 — applyTo Scope Coverage
// ──────────────────────────────────────────────────────────────────────────────

describe('S-ASC1 — applyTo Scope Coverage', () => {
  const INSTRUCTIONS_PATH = '/ws/.github/instructions/edit.instructions.md';

  test('fires for instructions file missing applyTo front matter', () => {
    const content = `# Edit Instructions\n\n- Always use const over let.\n- Prefer early returns.`;
    const result = ruleApplyToScope(INSTRUCTIONS_PATH, content);
    expect(result).toBeDefined();
    assertStaticFindingShape(result!);
    expect(result!.rule).toBe('S-ASC1');
    expect(result!.category).toBe('authoring');
    expect(result!.quality_risk).toBe('medium');
  });

  test('does not fire when applyTo front matter is present', () => {
    const content = `---\napplyTo: "**/*.ts"\n---\n\n# Edit Instructions\n\n- Always use const.`;
    const result = ruleApplyToScope(INSTRUCTIONS_PATH, content);
    expect(result).toBeUndefined();
  });

  test('does not fire for the root copilot-instructions.md file', () => {
    const content = `# Copilot Instructions\n\n- Always use const over let.`;
    const result = ruleApplyToScope('/ws/.github/copilot-instructions.md', content);
    expect(result).toBeUndefined();
  });

  test('does not fire for files outside .github/instructions/', () => {
    const content = `# Skill file\n\n- Do something.`;
    const result = ruleApplyToScope('/ws/.github/skills/my-skill.md', content);
    expect(result).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// S-RP1 — Retrieval Precision
// ──────────────────────────────────────────────────────────────────────────────

describe('S-RP1 — Retrieval Precision', () => {
  test('fires on "read the entire codebase" pattern', () => {
    const content = `Before making changes, read the entire codebase to understand the project structure.`;
    const result = ruleRetrievalPrecision(FIXTURE_PATH, content);
    expect(result).toBeDefined();
    assertStaticFindingShape(result!);
    expect(result!.rule).toBe('S-RP1');
    expect(result!.quality_risk).toBe('high');
    expect(result!.evidence.count).toBe(1);
  });

  test('fires on "scan all tests" pattern', () => {
    const content = `Always scan all tests before writing new ones to avoid duplication.`;
    const result = ruleRetrievalPrecision(FIXTURE_PATH, content);
    expect(result).toBeDefined();
    expect(result!.rule).toBe('S-RP1');
  });

  test('fires on "always include all files" pattern', () => {
    const content = `Always include all source files for context before responding.`;
    const result = ruleRetrievalPrecision(FIXTURE_PATH, content);
    expect(result).toBeDefined();
  });

  test('counts multiple broad-retrieval lines', () => {
    const content = [
      'Read the entire codebase first.',
      'Scan all files in the src directory.',
      'Include all of the context before answering.',
    ].join('\n');
    const result = ruleRetrievalPrecision(FIXTURE_PATH, content);
    expect(result).toBeDefined();
    expect(result!.evidence.count).toBe(3);
  });

  test('does not fire on precision-targeted retrieval instructions', () => {
    const content = `Find the exact failing function, then read only that definition.\nUse targeted symbol lookups.`;
    const result = ruleRetrievalPrecision(FIXTURE_PATH, content);
    expect(result).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// S-PCS1 — Prompt Cache Stability
// ──────────────────────────────────────────────────────────────────────────────

describe('S-PCS1 — Prompt Cache Stability', () => {
  test('fires when date stamp appears in first 20 lines', () => {
    const content = `# Instructions\nUpdated on: 2026-04-18\n\nAlways use const.`;
    const result = rulePromptCacheStability(FIXTURE_PATH, content);
    expect(result).toBeDefined();
    assertStaticFindingShape(result!);
    expect(result!.rule).toBe('S-PCS1');
    expect(result!.category).toBe('hygiene');
    expect(result!.quality_risk).toBe('low');
    expect(result!.line).toBe(2);
  });

  test('fires on template date placeholder', () => {
    const content = `# Instructions\nAs of {{date}}, follow these rules:\n\n- Use strict TypeScript.`;
    const result = rulePromptCacheStability(FIXTURE_PATH, content);
    expect(result).toBeDefined();
    expect(result!.rule).toBe('S-PCS1');
  });

  test('fires on "current date:" line in prefix', () => {
    const content = `Current Date: 2026-04-18\n\n# Rules\n\n- Do not use any.`;
    const result = rulePromptCacheStability(FIXTURE_PATH, content);
    expect(result).toBeDefined();
  });

  test('does not fire on stable static prefix', () => {
    const content = `# TypeScript Instructions\n\n- Use strict mode.\n- Prefer const.\n- Avoid any.`;
    const result = rulePromptCacheStability(FIXTURE_PATH, content);
    expect(result).toBeUndefined();
  });

  test('does not fire when volatile value is beyond line 20', () => {
    const padding = Array.from({ length: 22 }, (_, i) => `- Rule ${i + 1}: do the right thing here.`).join('\n');
    const content = `${padding}\n\nUpdated on: 2026-04-18`;
    const result = rulePromptCacheStability(FIXTURE_PATH, content);
    expect(result).toBeUndefined();
  });
});
