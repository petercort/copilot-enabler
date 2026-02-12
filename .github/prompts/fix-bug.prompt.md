---
mode: agent
tools: ["read_file", "run_in_terminal"]
description: "Diagnose and fix a bug with regression tests"
---

# Fix Bug in Copilot Enabler

You are diagnosing and fixing a bug in the Copilot Enabler VS Code extension.

## Diagnosis Steps

1. **Reproduce** — Understand the symptoms. Is a feature not detected? A recommendation duplicated? A score incorrect?
2. **Trace the pipeline** — Follow data through the detection chain:
   - **Scanner** (`src/core/scanner/`): What hints are being produced?
   - **Hints merge** (`mergeHints` in `agents/helpers.ts`): Are all scanner outputs included?
   - **Feature matching** (`featureDetected` in `agents/helpers.ts`): Does any `detectHint` match a produced hint? (Exact lowercase key lookup, not substring)
   - **Agent** (`src/core/agents/`): Is the feature's category handled by an agent?
   - **Analyzer** (`src/core/analyzer.ts`): Is deduplication dropping valid entries?
   - **Views** (`src/views/`): Is the UI rendering the data correctly?
3. **Check for common issues**:
   - `detectHints` contains a string not produced by any scanner (dead hint)
   - `knownHints` has an entry not referenced by any feature's `detectHints` (orphan hint)
   - Case mismatch — `featureDetected()` lowercases hints, but did the scanner produce the right casing?
   - Recommendation dedup uses `featureID` — two agents recommending same feature keeps only the first

## Fix Process

1. **Write a failing test first** that demonstrates the bug.
2. **Make the minimal fix** — change only what's necessary.
3. **Run `npx jest --no-coverage`** — the new test should now pass, and no existing tests should break.
4. **Run `npx tsc --noEmit`** — no type errors.

## Regression Test Pattern

```typescript
test('bug-description: feature-id detected from realistic-scenario', () => {
  const hints = new Map<string, boolean>();
  detectHintsInText('realistic log/setting text that triggered the bug', hints);
  const feature = byId('feature-id');
  expect(featureDetected(feature, hints)).toBe(true); // was false before fix
});
```
