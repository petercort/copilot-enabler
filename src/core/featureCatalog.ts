// Port of internal/features/feature.go + catalog.go

/** Category represents a grouping of Copilot features. */
export type Category =
  | 'Core'
  | 'Tools'
  | 'Customization';

/** AllCategories returns every category in display order. */
export const allCategories: Category[] = [
  'Core',
  'Tools',
  'Customization',
];

/** Feature describes a single Copilot capability. */
export interface Feature {
  id: string;
  name: string;
  category: Category;
  description: string;
  docsURL: string;
  /**
   * detectHints may be either plain strings (keywords) or objects that
   * specify a hint and an optional file path to search specifically.
   * Example: { hint: 'hooks', path: '.github/hooks/prerun.json' }
   */
  detectHints: Array<string | { hint: string; path?: string }>;
  impact: 'low' | 'medium' | 'high';
  difficulty: 'low' | 'medium' | 'high';
  setupSteps: string[];
  /** The minimum VS Code version in which this feature became available (MAJOR.MINOR.PATCH). */
  addedIn: string;
}

/** FeaturesByCategory groups a slice of features by their category. */
export function featuresByCategory(all: Feature[]): Map<Category, Feature[]> {
  const out = new Map<Category, Feature[]>();
  for (const f of all) {
    const list = out.get(f.category) ?? [];
    list.push(f);
    out.set(f.category, list);
  }
  return out;
}

/** FeatureIDs returns just the IDs from a slice of features. */
export function featureIDs(all: Feature[]): string[] {
  return all.map((f) => f.id);
}

import { getFeatureDefinitions } from './features/registry';

/** Catalog returns the full registry of known Copilot features. */
export function catalog(): Feature[] {
  return getFeatureDefinitions();
}

/** Returns the set of feature IDs the user has hidden via settings. Uses vscode API when available. */
export function getHiddenFeatureIDs(): Set<string> {
  try {
    // Dynamic import to avoid breaking non-vscode test environments
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('copilotEnabler');
    const hidden: string[] = config.get('hiddenFeatures', []);
    return new Set(hidden);
  } catch {
    return new Set();
  }
}

/** Returns the catalog filtered to only visible (non-hidden) features. */
export function visibleCatalog(): Feature[] {
  const hidden = getHiddenFeatureIDs();
  if (hidden.size === 0) { return catalog(); }
  return catalog().filter((f) => !hidden.has(f.id));
}

// ──────────────────────────────────────────────────────────────────────────────
// Version helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compares two semver strings (MAJOR.MINOR.PATCH). Ignores pre-release suffixes.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const parse = (v: string): [number, number, number] | null => {
    const m = v.replace(/-.*$/, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!m) { return null; }
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) {
    // Fall back to string comparison when either side is malformed
    return a < b ? -1 : a > b ? 1 : 0;
  }
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) { return -1; }
    if (pa[i] > pb[i]) { return 1; }
  }
  return 0;
}

/** Returns the running VS Code version, or undefined when not in a VS Code host (e.g., tests). */
export function getRunningVscodeVersion(): string | undefined {
  try {
    const vscode = require('vscode');
    return vscode.version as string;
  } catch {
    return undefined;
  }
}

/** Returns the value of `copilotEnabler.latestVersionChecked`, defaulting to '1.110.0'. */
export function getLatestVersionChecked(): string {
  try {
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('copilotEnabler');
    return (config.get('latestVersionChecked', '1.110.0') as string) || '1.110.0';
  } catch {
    return '1.110.0';
  }
}

/**
 * Returns the availability of a feature relative to the running VS Code version.
 * - 'unavailable' — running version is known and older than feature's addedIn.
 * - 'new'         — addedIn matches the running version on MAJOR.MINOR.
 * - 'available'   — otherwise (including when running version is unknown).
 */
export function getFeatureAvailability(feature: Feature): 'available' | 'new' | 'unavailable' {
  const running = getRunningVscodeVersion();
  if (!running) { return 'available'; }
  if (compareVersions(feature.addedIn, running) > 0) { return 'unavailable'; }
  // Check MAJOR.MINOR match for "new"
  const runningParts = running.replace(/-.*$/, '').split('.');
  const addedInParts = feature.addedIn.replace(/-.*$/, '').split('.');
  if (runningParts[0] === addedInParts[0] && runningParts[1] === addedInParts[1]) { return 'new'; }
  return 'available';
}
