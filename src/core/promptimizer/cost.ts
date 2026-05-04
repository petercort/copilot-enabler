// Anthropic pricing table and $/100-turn helpers per §5.2.
//
// Base `fresh` input rates are from GitHub Copilot pricing documentation.
// Cache tiers are derived multipliers (write5m = 1.25×, write1h = 1.25×, read = 0.1×).

import { CostModel, PricingModel, PricingTier, SessionUsage } from './types';

const WRITE_5M_MULT = 1.25;
const WRITE_1H_MULT = 1.25;
const READ_MULT = 0.1;

/** Base fresh-input rate in USD per MTok for each supported model. */
const BASE_FRESH_RATES: Record<PricingModel, number> = {
  'claude-sonnet-4.6': 3.0,
  'claude-sonnet-4.5': 3.0,
  'claude-opus-4.7': 5.0,
  'claude-opus-4.6': 5.0,
};

/** Build the full four-tier cost model for a given Anthropic model. */
export function costModelFor(model: PricingModel): CostModel {
  const fresh = BASE_FRESH_RATES[model];
  if (fresh === undefined) {
    throw new Error(`Unknown pricing model: ${model}`);
  }
  return {
    model,
    fresh,
    write5m: fresh * WRITE_5M_MULT,
    write1h: fresh * WRITE_1H_MULT,
    read: fresh * READ_MULT,
  };
}

/** Look up the USD/MTok rate for one tier. */
export function rateFor(model: PricingModel, tier: PricingTier): number {
  const m = costModelFor(model);
  switch (tier) {
    case 'fresh': return m.fresh;
    case 'write5m': return m.write5m;
    case 'write1h': return m.write1h;
    case 'read': return m.read;
    default: throw new Error(`Unknown pricing tier: ${tier as string}`);
  }
}

/**
 * Cost of sending `tokens` input across 100 turns at a single tier. This is
 * the simple "everything at one price" view — for cached vs uncached deltas
 * use {@link cachedCostUsdPer100Turns}.
 */
export function estimateUsdPer100Turns(
  tokens: number,
  model: PricingModel,
  tier: PricingTier,
  turns: number = 100,
): number {
  if (tokens < 0 || !Number.isFinite(tokens)) {
    throw new Error(`estimateUsdPer100Turns: invalid tokens ${tokens}`);
  }
  if (turns < 0 || !Number.isFinite(turns)) {
    throw new Error(`estimateUsdPer100Turns: invalid turns ${turns}`);
  }
  const rate = rateFor(model, tier);
  return (tokens * turns * rate) / 1_000_000;
}

/**
 * Cost to send `tokens` for `turns` requests with one initial cache write
 * at `writeTier` and `turns - 1` reads. Models §5.2's worked example.
 */
export function cachedCostUsdPer100Turns(
  tokens: number,
  model: PricingModel,
  writeTier: 'write5m' | 'write1h',
  turns: number = 100,
): number {
  if (turns < 1) { return 0; }
  const write = estimateUsdPer100Turns(tokens, model, writeTier, 1);
  const reads = estimateUsdPer100Turns(tokens, model, 'read', turns - 1);
  return write + reads;
}

/**
 * Effective input-cost rate scaling factor for a session that has authoritative
 * usage data. Returns the ratio of the session's actual blended input rate to
 * the plain fresh rate so that savings estimates can be corrected for caching.
 *
 * Without authoritative data (no `usage`) returns 1.0, leaving estimates at
 * their all-fresh baseline. When a session is heavily cached the factor can be
 * as low as 0.1 (all cache reads), which proportionally reduces overstated
 * savings produced by rules that assume every token is billed at the fresh rate.
 */
export function effectiveInputRateScale(usage: SessionUsage | undefined, model: PricingModel): number {
  if (!usage) { return 1.0; }
  const totalInput = usage.inputUncached + usage.cacheWrite + usage.cacheRead;
  if (totalInput === 0) { return 1.0; }
  const fresh = rateFor(model, 'fresh');
  const effectiveRate =
    (usage.inputUncached * fresh +
      usage.cacheWrite * fresh * WRITE_5M_MULT +
      usage.cacheRead * fresh * READ_MULT) /
    totalInput;
  return effectiveRate / fresh;
}

/** Savings from switching the given `tokens` from fresh to a cached tier. */
export function cacheSavingsUsdPer100Turns(
  tokens: number,
  model: PricingModel,
  writeTier: 'write5m' | 'write1h',
  turns: number = 100,
): number {
  const uncached = estimateUsdPer100Turns(tokens, model, 'fresh', turns);
  const cached = cachedCostUsdPer100Turns(tokens, model, writeTier, turns);
  return uncached - cached;
}
