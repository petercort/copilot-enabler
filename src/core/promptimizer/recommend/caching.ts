// Caching recommendations R-C1..R-C5, per §5.1. Each detector emits a
// §8-conformant Finding. v1 never auto-applies patches — they are carried
// through for v2 forward compatibility only.

import { cacheSavingsUsdPer100Turns } from '../cost';
import {
  Block,
  Finding,
  IngestedSession,
  IngestedTurn,
  PricingModel,
} from '../types';

/** Minimum prefix size eligible for caching on Sonnet/Opus (§5.1 R-C1). */
const MIN_CACHEABLE_TOKENS = 1024;
/** Minimum consecutive stable turns for R-C1. */
const MIN_STABLE_TURNS = 3;
/** Idle-gap threshold (ms) above which R-C2 recommends the 1h TTL. */
const LONG_IDLE_GAP_MS = 5 * 60 * 1000;
/** Lookback window size enforced by Anthropic caching (§5.1 R-C5). */
const LOOKBACK_WINDOW = 20;

function tokensOf(block: Block): number {
  return block.tokens ?? 0;
}

function inputTokenShareAfter(cachedTokens: number, totalTokens: number): number {
  if (totalTokens <= 0) { return 0; }
  const fresh = Math.max(0, totalTokens - cachedTokens);
  return Number((fresh / totalTokens).toFixed(4));
}

/**
 * For each block id appearing in the session, count how many consecutive
 * turns (starting from turn 0) kept its hash unchanged. A block is counted
 * as `stable` when the `stable` flag (set by diff.computeStability) is true
 * on every turn after the first.
 */
function countStableRun(session: IngestedSession, blockId: string): number {
  let run = 0;
  for (let i = 0; i < session.turns.length; i++) {
    const b = session.turns[i].blocks.find((x) => x.id === blockId);
    if (!b) { break; }
    if (i === 0) { run = 1; continue; }
    if (b.stable) { run++; } else { break; }
  }
  return run;
}

function totalTokensOnTurn(turn: IngestedTurn): number {
  let t = 0;
  for (const b of turn.blocks) { t += tokensOf(b); }
  return t;
}

function hasCacheBreakpoint(block: Block): boolean {
  return Boolean(block.cache_control);
}

/** R-C1: Cache the system+tools prefix when stable ≥3 turns and >1024 tokens. */
export function ruleRC1(session: IngestedSession, model: PricingModel): Finding | undefined {
  if (session.turns.length < MIN_STABLE_TURNS) { return undefined; }
  const lastTurn = session.turns[session.turns.length - 1];
  const prefix = lastTurn.blocks.filter(
    (b) => b.category === 'system' || b.category === 'mcp_tool' || b.category === 'built_in_tool',
  );
  if (prefix.length === 0) { return undefined; }

  let stableRunMin = Infinity;
  for (const b of prefix) {
    const run = countStableRun(session, b.id);
    if (run < stableRunMin) { stableRunMin = run; }
  }
  if (stableRunMin < MIN_STABLE_TURNS) { return undefined; }

  const tokens = prefix.reduce((s, b) => s + tokensOf(b), 0);
  if (tokens <= MIN_CACHEABLE_TOKENS) { return undefined; }

  const alreadyCached = prefix.some(hasCacheBreakpoint);
  if (alreadyCached) { return undefined; }

  const anchor = [...prefix].reverse().find((b) => b.category === 'system') ?? prefix[prefix.length - 1];
  const totalTokens = totalTokensOnTurn(lastTurn);
  const savings = cacheSavingsUsdPer100Turns(tokens, model, 'write5m', 100);

  return {
    rule: 'R-C1',
    category: 'caching',
    evidence: {
      blocks: prefix.map((b) => b.id),
      stable_turns: stableRunMin,
      tokens,
    },
    estimated_savings: {
      tokens_per_turn: 0,
      usd_per_100_turns: Number(savings.toFixed(2)),
      input_token_share_after: inputTokenShareAfter(tokens, totalTokens),
    },
    quality_risk: 'none',
    auto_applicable: true,
    patch: { type: 'insert_cache_control', after_block: anchor.id, ttl: '5m' },
    message: 'Cache the stable tools + system prefix to get ~90% off those tokens after the first hit.',
  };
}

/** R-C2: Promote the existing prefix cache to 1h TTL on long idle gaps. */
export function ruleRC2(session: IngestedSession, model: PricingModel): Finding | undefined {
  if (session.turns.length < 2) { return undefined; }

  const timestamps: number[] = [];
  for (const t of session.turns) {
    const ts = (t as IngestedTurn & { timestamp?: number | string }).timestamp;
    if (typeof ts === 'number') { timestamps.push(ts); }
    else if (typeof ts === 'string') {
      const n = Date.parse(ts);
      if (Number.isFinite(n)) { timestamps.push(n); }
    }
  }
  let idleHit = false;
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] - timestamps[i - 1] > LONG_IDLE_GAP_MS) { idleHit = true; break; }
  }
  if (!idleHit && session.turns.length < 10) { return undefined; }

  const lastTurn = session.turns[session.turns.length - 1];
  const cached = lastTurn.blocks.filter((b) => b.cache_control && b.cache_control.ttl !== '1h');
  if (cached.length === 0) { return undefined; }

  const tokens = cached.reduce((s, b) => s + tokensOf(b), 0);
  if (tokens <= 0) { return undefined; }

  const savings = cacheSavingsUsdPer100Turns(tokens, model, 'write1h', 100)
    - cacheSavingsUsdPer100Turns(tokens, model, 'write5m', 100);

  return {
    rule: 'R-C2',
    category: 'caching',
    evidence: { blocks: cached.map((b) => b.id), tokens },
    estimated_savings: {
      tokens_per_turn: 0,
      usd_per_100_turns: Number(Math.max(savings, 0).toFixed(2)),
      input_token_share_after: inputTokenShareAfter(tokens, totalTokensOnTurn(lastTurn)),
    },
    quality_risk: 'none',
    auto_applicable: true,
    patch: { type: 'change_cache_ttl', after_block: cached[cached.length - 1].id, ttl: '1h' },
    message: 'Long idle gaps detected — promote the existing cache entry to the 1h TTL to avoid repeated writes.',
  };
}

/** R-C3: Add a second breakpoint after a stable summary / history block. */
export function ruleRC3(session: IngestedSession, model: PricingModel): Finding | undefined {
  if (session.turns.length < MIN_STABLE_TURNS) { return undefined; }
  const lastTurn = session.turns[session.turns.length - 1];

  const prefixCached = lastTurn.blocks.find(hasCacheBreakpoint);
  if (!prefixCached) { return undefined; }

  const prefixIdx = lastTurn.blocks.indexOf(prefixCached);
  const tail = lastTurn.blocks.slice(prefixIdx + 1);

  const stableTail = tail.filter((b) => b.stable && tokensOf(b) > 0);
  if (stableTail.length === 0) { return undefined; }

  const stableTokens = stableTail.reduce((s, b) => s + tokensOf(b), 0);
  if (stableTokens <= MIN_CACHEABLE_TOKENS) { return undefined; }

  const last = stableTail[stableTail.length - 1];
  const savings = cacheSavingsUsdPer100Turns(stableTokens, model, 'write5m', 100);

  return {
    rule: 'R-C3',
    category: 'caching',
    evidence: { blocks: stableTail.map((b) => b.id), tokens: stableTokens },
    estimated_savings: {
      tokens_per_turn: 0,
      usd_per_100_turns: Number(savings.toFixed(2)),
      input_token_share_after: inputTokenShareAfter(stableTokens, totalTokensOnTurn(lastTurn)),
    },
    quality_risk: 'low',
    auto_applicable: true,
    patch: { type: 'insert_cache_control', after_block: last.id, ttl: '5m' },
    message: 'Add a second cache breakpoint after the stable history/summary to protect it from live-tail churn.',
  };
}

/** R-C4: A churning block sits between two stable blocks — reorder it. */
export function ruleRC4(session: IngestedSession): Finding | undefined {
  if (session.turns.length < 2) { return undefined; }
  const lastTurn = session.turns[session.turns.length - 1];
  const blocks = lastTurn.blocks;

  for (let i = 1; i < blocks.length - 1; i++) {
    const prev = blocks[i - 1];
    const curr = blocks[i];
    const next = blocks[i + 1];
    if (prev.stable && next.stable && curr.stable === false) {
      return {
        rule: 'R-C4',
        category: 'caching',
        evidence: { blocks: [prev.id, curr.id, next.id], tokens: tokensOf(curr) },
        estimated_savings: {
          tokens_per_turn: 0,
          usd_per_100_turns: 0,
          input_token_share_after: inputTokenShareAfter(0, totalTokensOnTurn(lastTurn)),
        },
        quality_risk: 'low',
        auto_applicable: false,
        patch: { type: 'move_block_after_breakpoint', before_block: curr.id, after_block: next.id },
        message: `Churning block ${curr.id} is interleaved between stable blocks — move it past the breakpoint to preserve the cache prefix.`,
      };
    }
  }
  return undefined;
}

/** R-C5: Blocks-between-breakpoints exceeds the 20-block lookback window. */
export function ruleRC5(session: IngestedSession): Finding | undefined {
  if (session.turns.length === 0) { return undefined; }
  const lastTurn = session.turns[session.turns.length - 1];
  const breakpoints: number[] = [];
  lastTurn.blocks.forEach((b, i) => { if (hasCacheBreakpoint(b)) { breakpoints.push(i); } });
  if (breakpoints.length === 0) { return undefined; }

  const lastBp = breakpoints[breakpoints.length - 1];
  const added = lastTurn.blocks.length - lastBp - 1;
  if (added <= LOOKBACK_WINDOW) { return undefined; }

  const candidate = lastTurn.blocks[lastBp + LOOKBACK_WINDOW];
  return {
    rule: 'R-C5',
    category: 'caching',
    evidence: {
      blocks: lastTurn.blocks.slice(lastBp + 1).map((b) => b.id),
      tokens: lastTurn.blocks.slice(lastBp + 1).reduce((s, b) => s + tokensOf(b), 0),
      added_blocks: added,
    },
    estimated_savings: {
      tokens_per_turn: 0,
      usd_per_100_turns: 0,
      input_token_share_after: inputTokenShareAfter(0, totalTokensOnTurn(lastTurn)),
    },
    quality_risk: 'medium',
    auto_applicable: true,
    patch: { type: 'insert_cache_control', after_block: candidate.id, ttl: '5m' },
    message: `Conversation has grown ${added} blocks past the last breakpoint — insert another before the 20-block lookback window expires.`,
  };
}

/** Run every R-C* rule over every session. */
export function runCachingRules(sessions: IngestedSession[], model: PricingModel): Finding[] {
  const findings: Finding[] = [];
  for (const session of sessions) {
    const rc1 = ruleRC1(session, model); if (rc1) { findings.push(rc1); }
    const rc2 = ruleRC2(session, model); if (rc2) { findings.push(rc2); }
    const rc3 = ruleRC3(session, model); if (rc3) { findings.push(rc3); }
    const rc4 = ruleRC4(session); if (rc4) { findings.push(rc4); }
    const rc5 = ruleRC5(session); if (rc5) { findings.push(rc5); }
  }
  return findings;
}
