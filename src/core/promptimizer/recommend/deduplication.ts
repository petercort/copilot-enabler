// Context deduplication rule. Fires when multiple blocks within a single
// turn carry highly overlapping text, causing redundant token spend.

import { effectiveInputRateScale, estimateUsdPer100Turns } from '../cost';
import { Block, Finding, IngestedSession, IngestedTurn, PricingModel, QualityRisk } from '../types';

function tokensOf(b: Block): number { return b.tokens ?? 0; }

// ──────────────────────────────────────────────────────────────────────────────
// Similarity helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Jaccard similarity over the word-bigram sets of two strings. */
function jaccardBigram(a: string, b: string): number {
  const bigrams = (s: string): Set<string> => {
    const words = s.toLowerCase().split(/\s+/).filter(Boolean);
    const set = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) {
      set.add(`${words[i]} ${words[i + 1]}`);
    }
    return set;
  };

  const sa = bigrams(a);
  const sb = bigrams(b);
  if (sa.size === 0 && sb.size === 0) { return 0; }

  let intersection = 0;
  for (const item of sa) { if (sb.has(item)) { intersection++; } }
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule R-DED1 — Semantic/Lexical Context Clashing
// ──────────────────────────────────────────────────────────────────────────────

/** Minimum Jaccard bigram similarity to flag two blocks as overlapping. */
const JACCARD_THRESHOLD = 0.75;
/** Minimum tokens per block for the comparison to be meaningful. */
const MIN_BLOCK_TOKENS = 100;
/** Block categories that should not duplicate each other's content. */
const COMPARABLE_CATEGORIES = new Set([
  'system',
  'custom_instruction',
  'skill',
  'mcp_tool',
  'built_in_tool',
]);

interface DupPair {
  blockA: Block;
  blockB: Block;
  similarity: number;
  wastedTokens: number;
}

function findDuplicatePairsInTurn(turn: IngestedTurn): DupPair[] {
  const candidates = turn.blocks.filter(
    (b) => COMPARABLE_CATEGORIES.has(b.category) && tokensOf(b) >= MIN_BLOCK_TOKENS,
  );

  const pairs: DupPair[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      // Skip same-category pairs — duplication within the same category is
      // handled by the dedup logic in staticScan / boilerplate rules.
      if (a.category === b.category) { continue; }
      const sim = jaccardBigram(a.text, b.text);
      if (sim < JACCARD_THRESHOLD) { continue; }
      // Wasted tokens: the smaller block is redundant.
      const wastedTokens = Math.min(tokensOf(a), tokensOf(b));
      pairs.push({ blockA: a, blockB: b, similarity: Number(sim.toFixed(3)), wastedTokens });
    }
  }
  return pairs;
}

/**
 * R-DED1 — Context Deduplication
 *
 * When multiple blocks from different categories (e.g. a skill and a
 * custom_instruction, or an MCP tool description and a system prompt) carry
 * ≥75% bigram-Jaccard overlap in a single turn, the smaller block is
 * redundant and should be merged or removed. Based on §1.2 of the research
 * ("Vector/Semantic Clashing").
 */
export function ruleDeduplication(session: IngestedSession, model: PricingModel): Finding | undefined {
  // Use the last turn as representative — it has the largest accumulated context.
  if (session.turns.length === 0) { return undefined; }
  const turn = session.turns[session.turns.length - 1];
  const pairs = findDuplicatePairsInTurn(turn);
  if (pairs.length === 0) { return undefined; }

  const totalWasted = pairs.reduce((s, p) => s + p.wastedTokens, 0);
  const savings = estimateUsdPer100Turns(totalWasted, model, 'fresh', 100) *
    effectiveInputRateScale(session.usage, model);

  // Collect unique block IDs from all pairs.
  const blockIds = [...new Set(pairs.flatMap((p) => [p.blockA.id, p.blockB.id]))];

  return {
    rule: 'R-DED1',
    category: 'hygiene',
    evidence: {
      blocks: blockIds,
      pairs: pairs.length,
      tokens: totalWasted,
      max_similarity: Math.max(...pairs.map((p) => p.similarity)),
      sample_pair: pairs[0]
        ? `${pairs[0].blockA.category}:"${(pairs[0].blockA.name ?? pairs[0].blockA.id).slice(0, 40)}" ↔ ` +
          `${pairs[0].blockB.category}:"${(pairs[0].blockB.name ?? pairs[0].blockB.id).slice(0, 40)}"`
        : '',
    },
    estimated_savings: {
      tokens_per_turn: totalWasted,
      usd_per_100_turns: Number(Math.max(savings, 0).toFixed(2)),
      input_token_share_after: 0,
    },
    quality_risk: 'medium' as QualityRisk,
    auto_applicable: false,
    patch: { type: 'merge_duplicate_context_blocks' },
    message:
      `${pairs.length} cross-category block pair(s) share ≥${Math.round(JACCARD_THRESHOLD * 100)}% content overlap ` +
      `(~${totalWasted} wasted tokens/turn). Merge overlapping context or remove the lower-priority block.`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Runner
// ──────────────────────────────────────────────────────────────────────────────

export function runDeduplicationRules(sessions: IngestedSession[], model: PricingModel): Finding[] {
  const out: Finding[] = [];
  for (const s of sessions) {
    const d = ruleDeduplication(s, model); if (d) { out.push(d); }
  }
  return out;
}
