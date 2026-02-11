// Port of internal/agents/helpers.go

import { Feature } from '../featureCatalog';
import { Recommendation } from './agent';

/** Merge multiple hint maps into one. */
export function mergeHints(...maps: Map<string, boolean>[]): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const m of maps) {
    for (const [k, v] of m) {
      if (v) {
        out.set(k, true);
      }
    }
  }
  return out;
}

/** Check if a feature is detected in the hints. */
export function featureDetected(f: Feature, hints: Map<string, boolean>): boolean {
  for (const h of f.detectHints) {
    if (h && hints.get(h.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/** Get display names from a list of features. */
export function featureNames(ff: Feature[]): string[] {
  return ff.map((f) => f.name);
}

/**
 * matrixScore computes a ranking score from Impact x Difficulty.
 * Higher score = recommend first (high impact + low difficulty = quick win).
 *
 *              Difficulty
 *          Low    Medium    High
 * High   |  9   |   6    |   3   |  Impact
 * Medium |  6   |   3    |   1   |
 * Low    |  3   |   1    |   1   |
 */
export function matrixScore(impact: string, difficulty: string): number {
  const impactVal = levelToInt(impact);
  const diffScores: Record<string, number> = { low: 3, medium: 2, high: 1 };
  const diffScore = diffScores[difficulty] ?? 1;
  return impactVal * diffScore;
}

function levelToInt(level: string): number {
  switch (level) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 1;
  }
}

/** starsFromScore converts a matrix score to a star rating string. */
export function starsFromScore(score: number): string {
  if (score >= 9) {
    return '★★★';
  }
  if (score >= 6) {
    return '★★☆';
  }
  if (score >= 3) {
    return '★☆☆';
  }
  return '☆☆☆';
}

/** buildRecommendation creates a Recommendation from a Feature using the matrix scoring. */
export function buildRecommendation(f: Feature, verb: string): Recommendation {
  const score = matrixScore(f.impact, f.difficulty);
  return {
    featureID: f.id,
    matrixScore: score,
    title: `${verb} ${f.name}`,
    description: f.description,
    category: f.category,
    actionItems: f.setupSteps,
    docsURL: f.docsURL,
    impact: f.impact,
    difficulty: f.difficulty,
    stars: starsFromScore(score),
  };
}
