// Shared, cached index over feature detectHints used by the log and workspace
// scanners. Centralising this avoids re-iterating the registry on every scan
// and lets the log scanner match all hints in a single regex pass per line.

import { getFeatureDefinitions } from './registry';

export interface HintIndex {
  /** Lowercased keyword hints, used for log text matching. */
  textHints: string[];
  /** File-path / glob hints, used by the workspace scanner. */
  filePathHints: string[];
  /** Single regex matching any keyword hint (global, case-insensitive flag not needed — text is pre-lowered). */
  textRegex: RegExp;
}

let cached: HintIndex | undefined;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isFilePathHint(hint: string): boolean {
  return hint.includes('/') || hint.includes('*');
}

function build(): HintIndex {
  const textHints = new Set<string>();
  const filePathHints: string[] = [];

  for (const f of getFeatureDefinitions()) {
    for (const raw of f.detectHints) {
      const hint = typeof raw === 'string' ? raw : raw.hint;
      if (!hint) { continue; }
      // All hints are eligible for text matching (lowercased) to preserve
      // the historical scanner behaviour, which searched every hint.
      textHints.add(hint.toLowerCase());
      if (isFilePathHint(hint)) {
        filePathHints.push(hint);
      }
    }
  }

  const textHintList = Array.from(textHints);
  // Sort longest-first so the alternation prefers a longer hint at any given
  // position. Overlapping shorter hints are still found because we advance by
  // 1 char after each (zero-width) match.
  const sorted = textHintList.slice().sort((a, b) => b.length - a.length);
  const pattern = sorted.length === 0
    ? '(?!)' // never matches
    : '(?=(' + sorted.map(escapeRegex).join('|') + '))';
  const textRegex = new RegExp(pattern, 'g');

  return { textHints: textHintList, filePathHints, textRegex };
}

export function getHintIndex(): HintIndex {
  if (!cached) { cached = build(); }
  return cached;
}

export function resetHintIndex(): void {
  cached = undefined;
}
