// Rule registry. v1 only registers the caching rules (§5.1); authoring and
// hygiene rules will plug in here later via `registerRuleSet`.

import { Finding, IngestedSession, PricingModel, QualityRisk } from '../types';
import { runCachingRules } from './caching';

/** Rule set signature: given sessions + model, return zero or more findings. */
export type RuleSet = (sessions: IngestedSession[], model: PricingModel) => Finding[];

const ruleSets: RuleSet[] = [runCachingRules];

/** Register an additional rule set (v2: authoring, hygiene, compression). */
export function registerRuleSet(rs: RuleSet): void {
  ruleSets.push(rs);
}

const RISK_WEIGHT: Record<QualityRisk, number> = {
  none: 1.0,
  low: 0.8,
  medium: 0.5,
  high: 0.2,
};

/** Sort key per §8: `usd_per_100_turns × (1 / quality_risk_weight)`. */
export function scoreFinding(f: Finding): number {
  const w = RISK_WEIGHT[f.quality_risk] || RISK_WEIGHT.medium;
  return f.estimated_savings.usd_per_100_turns * (1 / w);
}

/** Run all registered rule sets and return findings sorted by score desc. */
export function runRules(sessions: IngestedSession[], model: PricingModel): Finding[] {
  const out: Finding[] = [];
  for (const rs of ruleSets) {
    out.push(...rs(sessions, model));
  }
  out.sort((a, b) => scoreFinding(b) - scoreFinding(a));
  return out;
}
