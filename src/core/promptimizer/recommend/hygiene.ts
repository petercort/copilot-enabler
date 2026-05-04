// Authoring-hygiene rules that fire on the content of injected blocks.
// These rules analyse custom_instruction, skill, and system blocks to
// surface prompt-engineering anti-patterns described in §2 of the research.

import { effectiveInputRateScale, estimateUsdPer100Turns } from '../cost';
import { Block, Finding, IngestedSession, PricingModel, QualityRisk } from '../types';

function tokensOf(b: Block): number { return b.tokens ?? 0; }

// ──────────────────────────────────────────────────────────────────────────────
// Rule R-FP1 — Performative Fluff
// ──────────────────────────────────────────────────────────────────────────────

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
 * R-FP1 — Performative Fluff
 *
 * Scan custom_instruction, skill, and system blocks for persona framing and
 * qualitative adverbs that modern fine-tuned models do not benefit from.
 * Each matching block wastes tokens on every turn it is injected.
 */
export function ruleFluff(session: IngestedSession, model: PricingModel): Finding | undefined {
  const hits: Block[] = [];

  for (const turn of session.turns) {
    for (const block of turn.blocks) {
      if (
        block.category !== 'custom_instruction' &&
        block.category !== 'skill' &&
        block.category !== 'system'
      ) { continue; }

      for (const re of FLUFF_PATTERNS) {
        if (re.test(block.text)) {
          // Only count a block once even if multiple patterns match.
          if (!hits.find((h) => h.id === block.id)) { hits.push(block); }
          break;
        }
      }
    }
  }
  if (hits.length === 0) { return undefined; }

  // Deduplicate to unique block IDs for the savings estimate.
  const uniqueBlocks = [...new Map(hits.map((b) => [b.id, b])).values()];
  const totalTokens = uniqueBlocks.reduce((s, b) => s + tokensOf(b), 0);
  // Fluff phrases are a small fraction of each block; estimate 5% is waste.
  const wastedTokens = Math.ceil(totalTokens * 0.05);
  const savings = estimateUsdPer100Turns(wastedTokens, model, 'fresh', 100) *
    effectiveInputRateScale(session.usage, model);

  return {
    rule: 'R-FP1',
    category: 'authoring',
    evidence: {
      blocks: uniqueBlocks.map((b) => b.id),
      count: uniqueBlocks.length,
      tokens: wastedTokens,
      sample: hits[0].text.slice(0, 160),
    },
    estimated_savings: {
      tokens_per_turn: wastedTokens,
      usd_per_100_turns: Number(Math.max(savings, 0).toFixed(2)),
      input_token_share_after: 0,
    },
    quality_risk: 'low' as QualityRisk,
    auto_applicable: false,
    patch: { type: 'rewrite_fluff_to_constraints' },
    message:
      `${uniqueBlocks.length} instruction block(s) contain performative fluff phrases. ` +
      `Replace persona framing with concrete structural constraints (e.g. "Output only the modified code block.").`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule R-RB1 — Rule Bloat
// ──────────────────────────────────────────────────────────────────────────────

/** Bullet count per block above which an instruction block is over-specified. */
const RULE_BLOAT_THRESHOLD = 25;

/**
 * R-RB1 — Rule Bloat
 *
 * custom_instruction or system blocks with >25 bullet points degrade model
 * accuracy. Style and formatting rules belong in linters, not LLM instructions.
 */
export function ruleRuleBloat(session: IngestedSession, model: PricingModel): Finding | undefined {
  const hits: Array<{ block: Block; count: number }> = [];

  for (const turn of session.turns) {
    for (const block of turn.blocks) {
      if (block.category !== 'custom_instruction' && block.category !== 'system') { continue; }
      const bullets = block.text.match(/^[ \t]*[-*+]\s+.+/gm) ?? [];
      if (bullets.length > RULE_BLOAT_THRESHOLD) {
        if (!hits.find((h) => h.block.id === block.id)) {
          hits.push({ block, count: bullets.length });
        }
      }
    }
  }
  if (hits.length === 0) { return undefined; }

  const totalTokens = hits.reduce((s, h) => s + tokensOf(h.block), 0);
  // Conservatively estimate 30% of a bloated block is low-value rules.
  const wastedTokens = Math.ceil(totalTokens * 0.3);
  const savings = estimateUsdPer100Turns(wastedTokens, model, 'fresh', 100) *
    effectiveInputRateScale(session.usage, model);

  return {
    rule: 'R-RB1',
    category: 'authoring',
    evidence: {
      blocks: hits.map((h) => h.block.id),
      count: hits.length,
      max_bullet_count: Math.max(...hits.map((h) => h.count)),
      tokens: wastedTokens,
    },
    estimated_savings: {
      tokens_per_turn: wastedTokens,
      usd_per_100_turns: Number(Math.max(savings, 0).toFixed(2)),
      input_token_share_after: 0,
    },
    quality_risk: 'low' as QualityRisk,
    auto_applicable: false,
    patch: { type: 'consolidate_rule_bullets' },
    message:
      `${hits.length} instruction block(s) have >${RULE_BLOAT_THRESHOLD} bullet points (max: ${Math.max(...hits.map((h) => h.count))}). ` +
      `Move formatting/style rules to a linter config and keep instructions focused on logic constraints.`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule R-FS1 — Few-Shot Overload
// ──────────────────────────────────────────────────────────────────────────────

/** Min code-fence pairs in a single block to trigger R-FS1. */
const FEW_SHOT_FENCE_THRESHOLD = 3;
/** Min tokens for the block to be worth flagging. */
const FEW_SHOT_TOKEN_THRESHOLD = 800;

/**
 * R-FS1 — Few-Shot Overload
 *
 * skill or custom_instruction blocks with ≥3 code-fence example pairs and
 * >800 tokens cause format-anchoring drift where the model mirrors example
 * content into unrelated outputs.
 */
export function ruleFewShot(session: IngestedSession, model: PricingModel): Finding | undefined {
  const hits: Array<{ block: Block; fenceCount: number }> = [];

  for (const turn of session.turns) {
    for (const block of turn.blocks) {
      if (block.category !== 'skill' && block.category !== 'custom_instruction') { continue; }
      if (tokensOf(block) < FEW_SHOT_TOKEN_THRESHOLD) { continue; }
      const fences = block.text.match(/^```/gm) ?? [];
      const exampleCount = Math.floor(fences.length / 2);
      if (exampleCount < FEW_SHOT_FENCE_THRESHOLD) { continue; }
      if (!hits.find((h) => h.block.id === block.id)) {
        hits.push({ block, fenceCount: exampleCount });
      }
    }
  }
  if (hits.length === 0) { return undefined; }

  const totalTokens = hits.reduce((s, h) => s + tokensOf(h.block), 0);
  // Distilling to 1-2 examples typically reduces block tokens by ~60%.
  const wastedTokens = Math.ceil(totalTokens * 0.6);
  const savings = estimateUsdPer100Turns(wastedTokens, model, 'fresh', 100) *
    effectiveInputRateScale(session.usage, model);

  return {
    rule: 'R-FS1',
    category: 'authoring',
    evidence: {
      blocks: hits.map((h) => h.block.id),
      count: hits.length,
      max_fence_count: Math.max(...hits.map((h) => h.fenceCount)),
      tokens: totalTokens,
    },
    estimated_savings: {
      tokens_per_turn: wastedTokens,
      usd_per_100_turns: Number(Math.max(savings, 0).toFixed(2)),
      input_token_share_after: 0,
    },
    quality_risk: 'medium' as QualityRisk,
    auto_applicable: false,
    patch: { type: 'distil_few_shot_examples' },
    message:
      `${hits.length} skill/instruction block(s) contain ≥${FEW_SHOT_FENCE_THRESHOLD} code-fence examples. ` +
      `Distil to 1-2 tight pairs or switch to a zero-shot JSON-schema constraint to prevent format-anchoring drift.`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule R-SH1 — Session Hygiene
// ──────────────────────────────────────────────────────────────────────────────

/** Min turns before a session is long enough to have stale-middle risk. */
const SESSION_HYGIENE_MIN_TURNS = 10;
/**
 * If average token share of re-injected instruction blocks stays > this
 * fraction across turns, the middle context is likely stale (§3.A.4).
 */
const SESSION_HYGIENE_NOISE_RATIO = 0.40;

/**
 * R-SH1 — Session Hygiene
 *
 * Long sessions (≥10 turns) where instruction/skill blocks make up ≥40% of
 * the per-turn token budget often suffer from stale middle context ("Lost in
 * the Middle" phenomenon). Quality degrades as earlier task constraints become
 * diluted by accumulated history. A restart summary with active constraints
 * and fresh context recovers quality without increasing token spend.
 */
export function ruleSessionHygiene(session: IngestedSession, model: PricingModel): Finding | undefined {
  if (session.turns.length < SESSION_HYGIENE_MIN_TURNS) { return undefined; }

  let totalTurnTokens = 0;
  let instructionTurnTokens = 0;
  const instructionBlockIds: string[] = [];

  for (const turn of session.turns) {
    for (const block of turn.blocks) {
      const t = tokensOf(block);
      totalTurnTokens += t;
      if (
        block.category === 'custom_instruction' ||
        block.category === 'skill' ||
        block.category === 'system'
      ) {
        instructionTurnTokens += t;
        if (!instructionBlockIds.includes(block.id)) { instructionBlockIds.push(block.id); }
      }
    }
  }

  if (totalTurnTokens === 0) { return undefined; }
  const noiseRatio = instructionTurnTokens / totalTurnTokens;
  if (noiseRatio < SESSION_HYGIENE_NOISE_RATIO) { return undefined; }

  // Savings: compressing mid-session history by ~50% of instruction overhead.
  const avgInstructionPerTurn = instructionTurnTokens / session.turns.length;
  const wastedPerTurn = Math.ceil(avgInstructionPerTurn * 0.5);
  const savings = estimateUsdPer100Turns(wastedPerTurn, model, 'fresh', 100) *
    effectiveInputRateScale(session.usage, model);

  return {
    rule: 'R-SH1',
    category: 'hygiene',
    evidence: {
      blocks: instructionBlockIds.slice(0, 10),
      turns: session.turns.length,
      instructionNoiseRatio: Number(noiseRatio.toFixed(3)),
      tokens: wastedPerTurn,
    },
    estimated_savings: {
      tokens_per_turn: wastedPerTurn,
      usd_per_100_turns: Number(Math.max(savings, 0).toFixed(2)),
      input_token_share_after: Number((noiseRatio * 0.5).toFixed(3)),
    },
    quality_risk: 'medium' as QualityRisk,
    auto_applicable: false,
    patch: { type: 'generate_restart_summary' },
    message:
      `Session has ${session.turns.length} turns with ${Math.round(noiseRatio * 100)}% instruction noise ratio. ` +
      `Generate a compressed restart summary (active constraints + current task state) and open a new thread ` +
      `to recover quality degraded by stale middle context.`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule R-TCU1 — Tool Catalog Utility
// ──────────────────────────────────────────────────────────────────────────────

/** Min tokens for an mcp_tool schema to be worth flagging as unused overhead. */
const TOOL_SCHEMA_MIN_TOKENS = 100;

/**
 * R-TCU1 — Tool Catalog Utility
 *
 * MCP tool schemas are injected as always-on context every turn, even when the
 * tool is never called. If a session contains mcp_tool blocks with significant
 * token cost but zero corresponding tool_result blocks, those schemas represent
 * pure recurring token tax (§3.A.3). Lazy-load tools based on intent routing
 * or file-type signals instead.
 */
export function ruleToolCatalogUtility(session: IngestedSession, model: PricingModel): Finding | undefined {
  // Collect tool names that produced at least one tool_result.
  const invokedTools = new Set<string>();
  for (const turn of session.turns) {
    for (const block of turn.blocks) {
      if (block.category === 'tool_result' && block.name) {
        invokedTools.add(block.name);
      }
    }
  }

  // Find mcp_tool blocks that were never invoked.
  const unusedTools: Array<{ id: string; name: string; tokens: number }> = [];
  const seenNames = new Set<string>();

  for (const turn of session.turns) {
    for (const block of turn.blocks) {
      if (block.category !== 'mcp_tool') { continue; }
      const name = block.name ?? block.id;
      if (seenNames.has(name)) { continue; }
      seenNames.add(name);
      const t = tokensOf(block);
      if (t < TOOL_SCHEMA_MIN_TOKENS) { continue; }
      if (!invokedTools.has(name)) {
        unusedTools.push({ id: block.id, name, tokens: t });
      }
    }
  }
  if (unusedTools.length === 0) { return undefined; }

  const totalUnusedTokens = unusedTools.reduce((s, t) => s + t.tokens, 0);
  // These tokens are paid every turn — full savings if lazy-loaded.
  const savings = estimateUsdPer100Turns(totalUnusedTokens, model, 'fresh', 100) *
    effectiveInputRateScale(session.usage, model);

  return {
    rule: 'R-TCU1',
    category: 'hygiene',
    evidence: {
      blocks: unusedTools.map((t) => t.id),
      unusedTools: unusedTools.map((t) => t.name),
      tokens: totalUnusedTokens,
    },
    estimated_savings: {
      tokens_per_turn: totalUnusedTokens,
      usd_per_100_turns: Number(Math.max(savings, 0).toFixed(2)),
      input_token_share_after: 0,
    },
    quality_risk: 'none' as QualityRisk,
    auto_applicable: false,
    patch: { type: 'lazy_load_tools', tools: unusedTools.map((t) => t.name) },
    message:
      `${unusedTools.length} MCP tool schema(s) consume ~${totalUnusedTokens} tokens/turn but were never invoked ` +
      `in this session (${unusedTools.map((t) => t.name).join(', ')}). ` +
      `Lazy-load these tools based on intent signals (keywords, file type, git diff) to eliminate the recurring schema tax.`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Runner
// ──────────────────────────────────────────────────────────────────────────────

export function runHygieneRules(sessions: IngestedSession[], model: PricingModel): Finding[] {
  const out: Finding[] = [];
  for (const s of sessions) {
    const fp = ruleFluff(s, model); if (fp) { out.push(fp); }
    const rb = ruleRuleBloat(s, model); if (rb) { out.push(rb); }
    const fs = ruleFewShot(s, model); if (fs) { out.push(fs); }
    const sh = ruleSessionHygiene(s, model); if (sh) { out.push(sh); }
    const tcu = ruleToolCatalogUtility(s, model); if (tcu) { out.push(tcu); }
  }
  return out;
}
