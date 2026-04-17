// Static scanner for workspace customization files.
//
// Reads .github/copilot-instructions.md, .github/instructions/**, .github/prompts/**,
// .github/skills/**, .github/hooks/**, and .copilot/** without any VS Code API.
// Pure Node.js — mirrors the no-vscode-imports contract of ingest.ts.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { QualityRisk, StaticFinding } from './types';

// ──────────────────────────────────────────────────────────────────────────────
// File discovery
// ──────────────────────────────────────────────────────────────────────────────

/** Directories to walk recursively for markdown customization files. */
const DISCOVERY_DIRS = [
  '.github/instructions',
  '.github/prompts',
  '.github/skills',
  '.github/hooks',
  '.copilot',
];

/** Known single-file paths to check directly. */
const DIRECT_FILES = ['.github/copilot-instructions.md'];

/** Accepted file extensions for customization files. */
const ACCEPTED_EXTS = new Set(['.md', '.yaml', '.yml', '.json']);

function walkCustomization(dir: string, results: string[], maxDepth = 3): void {
  if (maxDepth <= 0) { return; }
  let items: fs.Dirent[];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      walkCustomization(full, results, maxDepth - 1);
    } else if (ACCEPTED_EXTS.has(path.extname(it.name).toLowerCase())) {
      results.push(full);
    }
  }
}

/**
 * Discover all customization files under the given workspace roots plus the
 * global ~/.copilot directory.
 */
export function discoverCustomizationFiles(rootPaths: string[]): string[] {
  const found: string[] = [];

  // Global ~/.copilot/copilot-instructions.md
  const globalFile = path.join(os.homedir(), '.copilot', 'copilot-instructions.md');
  if (fs.existsSync(globalFile)) { found.push(globalFile); }

  for (const root of rootPaths) {
    for (const rel of DIRECT_FILES) {
      const full = path.join(root, rel);
      if (fs.existsSync(full)) { found.push(full); }
    }
    for (const dir of DISCOVERY_DIRS) {
      walkCustomization(path.join(root, dir), found);
    }
  }

  // De-duplicate (same file may be reachable via multiple roots).
  return [...new Set(found)];
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function readFileSafe(filePath: string): string {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule S-FP1 — Performative Fluff
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Phrases that waste tokens on modern fine-tuned models (Part 2 §1 of research).
 * Matching any of these is a signal the instruction relies on pre-RLHF prompting
 * tricks that no longer contribute to output quality.
 */
const FLUFF_PATTERNS: RegExp[] = [
  /\byou are (a |an )?(world[- ]class|senior|expert|staff|10x|elite|rockstar|best)/i,
  /\bthink (deeply|carefully|step[- ]by[- ]step|hard) (about|before)/i,
  /\bplease (could you|help me|make sure|ensure|always|be sure to)/i,
  /\bact as (a |an )?(genius|senior|expert|experienced)/i,
  /\bbe (concise|helpful|friendly|thorough|professional) and\b/i,
  /\bdon't (babble|ramble|over-explain)\b/i,
  /\bpretend (you are|you're) (a |an )?/i,
  /\bimagine you('re| are) (a |an )?/i,
];

/**
 * S-FP1 — Performative Fluff
 * Flag lines containing persona framing or qualitative adverbs that modern
 * fine-tuned models do not benefit from. Replace with concrete structural
 * constraints.
 */
export function ruleFluffPhrases(filePath: string, content: string): StaticFinding | undefined {
  const lines = content.split('\n');
  const hitLines: number[] = [];
  const excerpts: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const re of FLUFF_PATTERNS) {
      if (re.test(line)) {
        hitLines.push(i + 1); // 1-indexed
        if (excerpts.length < 3) { excerpts.push(line.trim().slice(0, 120)); }
        break;
      }
    }
  }
  if (hitLines.length === 0) { return undefined; }

  return {
    rule: 'S-FP1',
    category: 'authoring',
    file: filePath,
    line: hitLines[0],
    evidence: { count: hitLines.length, lines: hitLines, excerpts },
    quality_risk: 'low' as QualityRisk,
    message:
      `${hitLines.length} performative fluff phrase(s) found. Replace with concrete structural constraints ` +
      `(e.g. "Output only the modified code block.") to reduce token waste on modern fine-tuned models.`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule S-RB1 — Rule Bloat
// ──────────────────────────────────────────────────────────────────────────────

/** Bullet count above which an instruction file is considered over-specified. */
const RULE_BLOAT_THRESHOLD = 25;

/**
 * S-RB1 — Rule Bloat
 * Instruction files with >25 bullet points degrade model accuracy. Style/format
 * rules belong in linters (ESLint, Prettier), not LLM instructions (Part 2 §3).
 */
export function ruleRuleBloat(filePath: string, content: string): StaticFinding | undefined {
  const bullets = content.match(/^[ \t]*[-*+]\s+.+/gm) ?? [];
  if (bullets.length <= RULE_BLOAT_THRESHOLD) { return undefined; }

  return {
    rule: 'S-RB1',
    category: 'authoring',
    file: filePath,
    evidence: { count: bullets.length },
    quality_risk: 'low' as QualityRisk,
    message:
      `${bullets.length} bullet points found (threshold: ${RULE_BLOAT_THRESHOLD}). ` +
      `Consolidate style rules into a linter config (ESLint/Prettier) and keep this file focused on logic constraints only.`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule S-FS1 — Few-Shot Overload
// ──────────────────────────────────────────────────────────────────────────────

/** Min code-fence pairs (examples) to trigger S-FS1. */
const FEW_SHOT_FENCE_THRESHOLD = 3;
/** Min estimated tokens for the file to be worth flagging. */
const FEW_SHOT_TOKEN_THRESHOLD = 800;

/**
 * S-FS1 — Few-Shot Overload
 * Files with ≥3 code-fence examples and >800 tokens cause format-anchoring
 * drift where the model mirrors example content into unrelated outputs (Part 2 §4).
 */
export function ruleFewShotOverload(filePath: string, content: string): StaticFinding | undefined {
  const fences = content.match(/^```/gm) ?? [];
  const exampleCount = Math.floor(fences.length / 2); // opening + closing = 1 example
  if (exampleCount < FEW_SHOT_FENCE_THRESHOLD) { return undefined; }

  const tokens = estimateTokens(content);
  if (tokens < FEW_SHOT_TOKEN_THRESHOLD) { return undefined; }

  return {
    rule: 'S-FS1',
    category: 'authoring',
    file: filePath,
    evidence: { fenceCount: exampleCount, tokens },
    quality_risk: 'medium' as QualityRisk,
    message:
      `${exampleCount} code-fence examples (~${tokens} tokens). Reduce to 1-2 tight pairs or switch to a ` +
      `zero-shot JSON-schema constraint to prevent format-anchoring drift.`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule S-DED1 — Cross-File Deduplication
// ──────────────────────────────────────────────────────────────────────────────

const DEDUP_JACCARD_THRESHOLD = 0.75;
/** Min paragraph count in each file for the comparison to be meaningful. */
const DEDUP_MIN_PARAGRAPHS = 3;

function buildParagraphSet(content: string): Set<string> {
  const set = new Set<string>();
  for (const para of content.split(/\n\s*\n/)) {
    const trimmed = para.trim();
    if (trimmed.length > 80) { set.add(trimmed); }
  }
  return set;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) { return 0; }
  let intersection = 0;
  for (const item of a) { if (b.has(item)) { intersection++; } }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface DedupPair {
  fileA: string;
  fileB: string;
  similarity: number;
  sharedParagraphs: number;
}

/** Compute all pairs of files that exceed the Jaccard similarity threshold. */
export function findDuplicatePairs(files: Array<{ path: string; content: string }>): DedupPair[] {
  const pairs: DedupPair[] = [];
  const entries = files.map((f) => ({ path: f.path, set: buildParagraphSet(f.content) }));

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.set.size < DEDUP_MIN_PARAGRAPHS || b.set.size < DEDUP_MIN_PARAGRAPHS) { continue; }
      const sim = jaccardSimilarity(a.set, b.set);
      if (sim < DEDUP_JACCARD_THRESHOLD) { continue; }
      let shared = 0;
      for (const p of a.set) { if (b.set.has(p)) { shared++; } }
      pairs.push({ fileA: a.path, fileB: b.path, similarity: Number(sim.toFixed(3)), sharedParagraphs: shared });
    }
  }
  return pairs;
}

function ruleCrossFileDuplication(files: Array<{ path: string; content: string }>): StaticFinding[] {
  return findDuplicatePairs(files).map((pair) => ({
    rule: 'S-DED1',
    category: 'hygiene' as const,
    file: pair.fileA,
    evidence: {
      fileB: pair.fileB,
      similarity: pair.similarity,
      sharedParagraphs: pair.sharedParagraphs,
    },
    quality_risk: 'medium' as QualityRisk,
    message:
      `${Math.round(pair.similarity * 100)}% paragraph overlap with "${path.basename(pair.fileB)}". ` +
      `Merge or deduplicate to avoid redundant context injection on every turn.`,
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Scan workspace customization files for token-waste anti-patterns.
 *
 * Checks .github/copilot-instructions.md, .github/instructions/**, .github/prompts/**,
 * .github/skills/**, .github/hooks/**, .copilot/**, and the global
 * ~/.copilot/copilot-instructions.md.
 *
 * @param rootPaths - Absolute paths to workspace root directories. If empty,
 *   only the global ~/.copilot file is checked.
 */
export function scanCustomizationFiles(rootPaths: string[]): StaticFinding[] {
  const filePaths = discoverCustomizationFiles(rootPaths);
  const loaded = filePaths
    .map((p) => ({ path: p, content: readFileSafe(p) }))
    .filter((f) => f.content.length > 0);

  const findings: StaticFinding[] = [];

  for (const { path: filePath, content } of loaded) {
    const fp1 = ruleFluffPhrases(filePath, content);
    if (fp1) { findings.push(fp1); }

    const rb1 = ruleRuleBloat(filePath, content);
    if (rb1) { findings.push(rb1); }

    const fs1 = ruleFewShotOverload(filePath, content);
    if (fs1) { findings.push(fs1); }
  }

  // Cross-file check — requires all loaded files at once.
  findings.push(...ruleCrossFileDuplication(loaded));

  return findings;
}
