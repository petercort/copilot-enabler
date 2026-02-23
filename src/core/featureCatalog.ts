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
