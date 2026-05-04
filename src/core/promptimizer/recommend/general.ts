// General-purpose recommendations that complement the caching rules.
// These fire on real Copilot CLI traffic where there is no explicit
// "system prompt" block but large boilerplate or bloated tool results
// can still produce measurable savings.

import { effectiveInputRateScale, estimateUsdPer100Turns } from '../cost';
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
  const per100 = saved * (100 / Math.max(1, session.turns.length)) * effectiveInputRateScale(session.usage, model);

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
  const N = session.turns.length;
  if (N === 0) { return undefined; }

  // Deduplicate by CONTENT HASH, not block ID.
  //
  // Block IDs in JSONL/HAR sources embed the current turn index, so the same
  // tool result (unchanged in conversation history) gets a fresh ID on every
  // turn. Deduplicating by ID would fail to merge those copies. Instead we
  // group by hash and track occurrence count, which correctly handles:
  //   - JSONL/HAR (full API payloads): same hash repeats every turn the result
  //     stays in history — occurrence count captures how long it persisted.
  //   - vscode debug logs (per-turn events only): each turn produces unique
  //     content so hash == ID; occurrence count = 1 per block.
  interface HashEntry { block: Block; occurrences: number; }
  const byHash = new Map<string, HashEntry>();

  for (const t of session.turns) {
    for (const b of t.blocks) {
      if (b.category !== 'tool_result') { continue; }
      if (tokensOf(b) < TOOL_RESULT_MAX_TOKENS) { continue; }
      const key = b.hash ?? b.id; // hash is set by computeStability before rules run
      const entry = byHash.get(key);
      if (entry) { entry.occurrences++; }
      else { byHash.set(key, { block: b, occurrences: 1 }); }
    }
  }
  if (byHash.size === 0) { return undefined; }

  // Per-turn impact: each unique block contributes proportionally to how often
  // it appeared. Summarizing recovers 75% of those tokens each time.
  // Summing (tokens × occurrences / N × 0.75) gives average tokens saved/turn.
  let recoveredPerTurn = 0;
  let totalTokens = 0;
  let maxTokens = 0;
  const evidenceBlocks: string[] = [];

  for (const { block, occurrences } of byHash.values()) {
    const t = tokensOf(block);
    totalTokens += t;
    if (t > maxTokens) { maxTokens = t; }
    recoveredPerTurn += t * (occurrences / N) * 0.75;
    evidenceBlocks.push(block.id);
  }

  recoveredPerTurn = Math.round(recoveredPerTurn);
  if (recoveredPerTurn === 0) { return undefined; }

  // Scale by the session's actual blended input rate so savings can't exceed
  // what the session actually costs at the observed cache mix.
  const rateScale = effectiveInputRateScale(session.usage, model);
  const freshPer100 = estimateUsdPer100Turns(recoveredPerTurn, model, 'fresh', 100) * rateScale;

  return {
    rule: 'R-TR1',
    category: 'hygiene',
    evidence: {
      blocks: evidenceBlocks.slice(0, 10),
      tokens: totalTokens,
      max_tool_result_tokens: maxTokens,
      count: byHash.size,
    },
    estimated_savings: {
      tokens_per_turn: recoveredPerTurn,
      usd_per_100_turns: Number(Math.max(freshPer100, 0).toFixed(2)),
      input_token_share_after: 0,
    },
    quality_risk: 'medium',
    auto_applicable: false,
    patch: { type: 'summarize_tool_result', after_block: evidenceBlocks[0] },
    message: `${byHash.size} unique oversize tool result(s) (largest: ${maxTokens} tok, avg ${recoveredPerTurn} tok/turn recoverable). ` +
      `Summarize or truncate before they bloat the context window.`,
  };
}

export function runGeneralRules(sessions: IngestedSession[], model: PricingModel): Finding[] {
  const out: Finding[] = [];
  for (const s of sessions) {
    const bp = ruleBoilerplate(s, model); if (bp) { out.push(bp); }
    const tr = ruleToolResultBloat(s, model); if (tr) { out.push(tr); }
    const mcp = ruleMcpToolOverhead(s, model); if (mcp) { out.push(mcp); }
    const lm = ruleLostInMiddle(s, model); if (lm) { out.push(lm); }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule R-MCP1 — Low-Return MCP Tool Overhead
// ──────────────────────────────────────────────────────────────────────────────

/** MCP tool cost above which we flag it as "loaded but never called". */
const MCP_TOKEN_OVERHEAD_THRESHOLD = 500;

/**
 * R-MCP1 — Low-Return MCP Tool Overhead
 *
 * mcp_tool blocks that are expensive (>500 tokens) and appear on every turn
 * but have zero paired tool_result blocks in the session are never actually
 * called. Their schema is burned every turn for no return. Based on §1.3
 * of the research ("Low Return-on-Tokens for Tools").
 */
export function ruleMcpToolOverhead(session: IngestedSession, model: PricingModel): Finding | undefined {
  if (session.turns.length < 3) { return undefined; }

  // Collect MCP tool names that appear in tool_result blocks (i.e. were called).
  const calledTools = new Set<string>();
  for (const turn of session.turns) {
    for (const b of turn.blocks) {
      if (b.category === 'tool_result' && b.name) { calledTools.add(b.name); }
    }
  }

  // Find expensive MCP tools that appear on ≥80% of turns but were never called.
  const turnCount = session.turns.length;
  const toolTurnCounts = new Map<string, { block: Block; count: number }>();

  for (const turn of session.turns) {
    for (const b of turn.blocks) {
      if (b.category !== 'mcp_tool') { continue; }
      if (tokensOf(b) < MCP_TOKEN_OVERHEAD_THRESHOLD) { continue; }
      const key = b.name ?? b.id;
      const entry = toolTurnCounts.get(key);
      if (entry) { entry.count++; } else { toolTurnCounts.set(key, { block: b, count: 1 }); }
    }
  }

  const neverCalled: Block[] = [];
  for (const [name, { block, count }] of toolTurnCounts) {
    if (calledTools.has(name)) { continue; }
    if (count / turnCount >= 0.8) { neverCalled.push(block); }
  }

  if (neverCalled.length === 0) { return undefined; }

  const totalTokens = neverCalled.reduce((s, b) => s + tokensOf(b), 0);
  const savings = estimateUsdPer100Turns(totalTokens, model, 'fresh', 100) *
    effectiveInputRateScale(session.usage, model);

  return {
    rule: 'R-MCP1',
    category: 'hygiene',
    evidence: {
      blocks: neverCalled.map((b) => b.id),
      count: neverCalled.length,
      tokens: totalTokens,
      tools: neverCalled.map((b) => b.name ?? b.id),
    },
    estimated_savings: {
      tokens_per_turn: totalTokens,
      usd_per_100_turns: Number(Math.max(savings, 0).toFixed(2)),
      input_token_share_after: 0,
    },
    quality_risk: 'low',
    auto_applicable: false,
    patch: { type: 'lazy_load_mcp_tool' },
    message:
      `${neverCalled.length} MCP tool(s) load on every turn (${totalTokens} tok) but are never called in this session. ` +
      `Use lazy tool loading — only inject these schemas when a triggering keyword or condition is present.`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule R-LM1 — Lost-in-the-Middle Tool Accumulation
// ──────────────────────────────────────────────────────────────────────────────

/** Minimum turns for a session to be a candidate for R-LM1. */
const LOST_IN_MIDDLE_MIN_TURNS = 12;

/**
 * R-LM1 — Lost-in-the-Middle Tool Accumulation
 *
 * In long sessions (≥12 turns), when the total tool-definition mass in the
 * middle 50% of turns exceeds that in the first and last turns combined, the
 * tools are adding noise without benefiting from the model's U-shaped attention.
 * Based on §1.6 (ContextBench) and the "Lost in the Middle" research.
 */
export function ruleLostInMiddle(session: IngestedSession, model: PricingModel): Finding | undefined {
  if (session.turns.length < LOST_IN_MIDDLE_MIN_TURNS) { return undefined; }

  const n = session.turns.length;
  const midStart = Math.floor(n * 0.25);
  const midEnd = Math.floor(n * 0.75);

  function toolTokensInRange(start: number, end: number): number {
    let total = 0;
    for (let i = start; i < end; i++) {
      for (const b of session.turns[i].blocks) {
        if (b.category === 'mcp_tool' || b.category === 'built_in_tool') {
          total += tokensOf(b);
        }
      }
    }
    return total;
  }

  const edgeTokens = toolTokensInRange(0, midStart) + toolTokensInRange(midEnd, n);
  const middleTokens = toolTokensInRange(midStart, midEnd);

  if (middleTokens <= edgeTokens) { return undefined; }
  if (middleTokens < 1000) { return undefined; } // not worth flagging tiny sessions

  const excessTokens = middleTokens - edgeTokens;
  const savings = estimateUsdPer100Turns(
    excessTokens,
    model,
    'fresh',
    // excessTokens is a session-level total, not a per-turn count.
    // Normalise to "per 100 turns" the same way R-TR1 does: 100 / session length.
    100 / session.turns.length,
  ) * effectiveInputRateScale(session.usage, model);

  // Gather representative block IDs from the middle range first turn.
  const midFirstTurn = session.turns[midStart];
  const blocks = midFirstTurn.blocks
    .filter((b) => b.category === 'mcp_tool' || b.category === 'built_in_tool')
    .map((b) => b.id);

  return {
    rule: 'R-LM1',
    category: 'hygiene',
    evidence: {
      blocks,
      middle_tool_tokens: middleTokens,
      edge_tool_tokens: edgeTokens,
      excess_tokens: excessTokens,
      turns: n,
      tokens: excessTokens,
    },
    estimated_savings: {
      tokens_per_turn: Math.round(excessTokens / n),
      usd_per_100_turns: Number(Math.max(savings, 0).toFixed(2)),
      input_token_share_after: 0,
    },
    quality_risk: 'medium',
    auto_applicable: false,
    patch: { type: 'reduce_mid_session_tool_load' },
    message:
      `Tool definitions in the middle ${Math.round((midEnd - midStart) / n * 100)}% of this ${n}-turn session ` +
      `(${middleTokens} tok) exceed the edges (${edgeTokens} tok). ` +
      `Reduce mid-session tool load — the model's U-shaped attention ignores middle context.`,
  };
}

