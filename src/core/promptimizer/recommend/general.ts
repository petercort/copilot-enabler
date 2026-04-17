// General-purpose recommendations that complement the caching rules.
// These fire on real Copilot CLI traffic where there is no explicit
// "system prompt" block but large boilerplate or bloated tool results
// can still produce measurable savings.

import { estimateUsdPer100Turns } from '../cost';
import { Block, Finding, IngestedSession, PricingModel } from '../types';

/** Min tokens for a repeated fragment to be worth promoting (R-BP1). */
const BOILERPLATE_MIN_TOKENS = 150;
/** Min number of turns a fragment must appear in verbatim (R-BP1). */
const BOILERPLATE_MIN_OCCURRENCES = 2;
/** Tool-result block size above which R-TR1 suggests summarizing. */
const TOOL_RESULT_MAX_TOKENS = 3000;

function tokensOf(b: Block): number { return b.tokens ?? 0; }

/**
 * R-BP1 (boilerplate promotion): If the same long substring appears verbatim
 * in N≥2 user_message blocks across different turns, it is likely static
 * instructions or reminders being re-sent on every turn. Promoting that text
 * to a cached system prompt removes the per-turn fresh-input cost.
 */
export function ruleBoilerplate(session: IngestedSession, model: PricingModel): Finding | undefined {
  if (session.turns.length < BOILERPLATE_MIN_OCCURRENCES) { return undefined; }

  // Collect user-message texts per turn (one joined string per turn).
  const userTexts: { turn: number; text: string; blockId: string; tokens: number }[] = [];
  for (const t of session.turns) {
    const ums = t.blocks.filter((b) => b.category === 'user_message');
    if (ums.length === 0) { continue; }
    const joined = ums.map((b) => b.text).join('\n');
    const tokens = ums.reduce((s, b) => s + tokensOf(b), 0);
    userTexts.push({ turn: t.turn, text: joined, blockId: ums[0].id, tokens });
  }
  if (userTexts.length < BOILERPLATE_MIN_OCCURRENCES) { return undefined; }

  // Find the longest common substring across ≥2 user messages using a simple
  // line-based approach (splitting on blank lines as boundary hints).
  const paragraphs = new Map<string, { turns: Set<number>; tokens: number }>();
  for (const { turn, text } of userTexts) {
    const blocks = text.split(/\n\s*\n/); // blank-line paragraphs
    for (const p of blocks) {
      const trimmed = p.trim();
      if (trimmed.length < 120) { continue; } // ~30 tokens; tight lower bound
      const estTokens = Math.ceil(trimmed.length / 4);
      if (estTokens < BOILERPLATE_MIN_TOKENS) { continue; }
      const e = paragraphs.get(trimmed);
      if (e) { e.turns.add(turn); }
      else { paragraphs.set(trimmed, { turns: new Set([turn]), tokens: estTokens }); }
    }
  }

  let best: { text: string; turns: number; tokens: number } | undefined;
  for (const [text, info] of paragraphs) {
    if (info.turns.size < BOILERPLATE_MIN_OCCURRENCES) { continue; }
    if (!best || info.tokens * info.turns.size > best.tokens * best.turns) {
      best = { text, turns: info.turns.size, tokens: info.tokens };
    }
  }
  if (!best) { return undefined; }

  // Savings: the boilerplate was sent fresh `best.turns` times. If moved to
  // system prompt and cached, we save (turns - 1) × fresh and pay one write.
  const freshPerTurn = estimateUsdPer100Turns(best.tokens, model, 'fresh', 1);
  const saved = freshPerTurn * Math.max(0, best.turns - 1);
  // Normalise to "per 100 turns" using observed frequency.
  const frequency = best.turns / session.turns.length;
  const per100 = saved * (100 / Math.max(1, session.turns.length));

  const anchorBlockId = userTexts[0].blockId;
  return {
    rule: 'R-BP1',
    category: 'authoring',
    evidence: {
      blocks: [anchorBlockId],
      tokens: best.tokens,
      occurrences: best.turns,
      frequency: Number(frequency.toFixed(3)),
      sample: best.text.slice(0, 160),
    },
    estimated_savings: {
      tokens_per_turn: best.tokens,
      usd_per_100_turns: Number(per100.toFixed(2)),
      input_token_share_after: 0,
    },
    quality_risk: 'low',
    auto_applicable: false,
    patch: { type: 'move_boilerplate_to_system', after_block: anchorBlockId },
    message: `Boilerplate (~${best.tokens} tok) is re-sent in ${best.turns} turns — move it into a cached system prompt / custom instructions.`,
  };
}

/**
 * R-TR1 (oversize tool result): Any single tool_result block above
 * TOOL_RESULT_MAX_TOKENS will hang around in the chat history and get
 * re-sent on every subsequent turn. Summarizing or truncating it
 * typically recovers 70–90% of those tokens.
 */
export function ruleToolResultBloat(session: IngestedSession, model: PricingModel): Finding | undefined {
  const hits: { block: Block; turn: number }[] = [];
  for (const t of session.turns) {
    for (const b of t.blocks) {
      if (b.category !== 'tool_result') { continue; }
      if (tokensOf(b) >= TOOL_RESULT_MAX_TOKENS) { hits.push({ block: b, turn: t.turn }); }
    }
  }
  if (hits.length === 0) { return undefined; }

  // Total tokens across all oversize results; each one is carried in every
  // subsequent turn's history, so savings compound.
  const totalTokens = hits.reduce((s, h) => s + tokensOf(h.block), 0);
  const turnsRemainingAvg = Math.max(
    1,
    Math.round(
      hits.reduce((s, h) => s + Math.max(0, session.turns.length - h.turn - 1), 0) / hits.length,
    ),
  );
  // Assume summarization recovers 75%.
  const recovered = Math.round(totalTokens * 0.75);
  const freshPer100 = estimateUsdPer100Turns(
    recovered * turnsRemainingAvg,
    model,
    'fresh',
    100 / Math.max(1, session.turns.length),
  );

  return {
    rule: 'R-TR1',
    category: 'hygiene',
    evidence: {
      blocks: hits.map((h) => h.block.id),
      tokens: totalTokens,
      max_tool_result_tokens: Math.max(...hits.map((h) => tokensOf(h.block))),
      count: hits.length,
    },
    estimated_savings: {
      tokens_per_turn: recovered,
      usd_per_100_turns: Number(Math.max(freshPer100, 0).toFixed(2)),
      input_token_share_after: 0,
    },
    quality_risk: 'medium',
    auto_applicable: false,
    patch: { type: 'summarize_tool_result', after_block: hits[0].block.id },
    message: `${hits.length} tool result(s) exceed ${TOOL_RESULT_MAX_TOKENS} tokens (largest: ${Math.max(
      ...hits.map((h) => tokensOf(h.block)),
    )}). Summarize or truncate before they bloat every subsequent turn.`,
  };
}

export function runGeneralRules(sessions: IngestedSession[], model: PricingModel): Finding[] {
  const out: Finding[] = [];
  for (const s of sessions) {
    const bp = ruleBoilerplate(s, model); if (bp) { out.push(bp); }
    const tr = ruleToolResultBloat(s, model); if (tr) { out.push(tr); }
  }
  return out;
}
