---
mode: agent
tools: ["read_file", "run_in_terminal"]
description: "Refactor code while maintaining test coverage and detection integrity"
---

# Refactor Copilot Enabler Code

You are refactoring code in the Copilot Enabler VS Code extension.

## Before Refactoring

1. **Read the source** — Understand the current implementation fully before changing it.
2. **Run tests first** — Execute `npx jest --no-coverage` to establish a green baseline.
3. **Check dependencies** — Search for all usages of functions/types you plan to change.

## Refactoring Rules

- **Never break detection**: If changing `detectHints` or `knownHints`, verify every hint remains reachable from at least one scanner path.
- **Keep tests passing**: Run `npx jest --no-coverage` after each significant change.
- **Update test assertions**: If refactoring changes feature counts, detection paths, or recommendation verbs, update corresponding test expectations.
- **Preserve the pipeline**: Scanner → Agent → Analyzer → Views. Don't short-circuit layers.
- **Type safety**: Use TypeScript's type system — avoid `as any` casts. Leverage `interface` for shapes.

## Common Refactors

### Moving detection hints
If relocating a hint between scanners, ensure:
1. The hint string appears in the target scanner's output
2. The `detectHints` array still references a matchable string
3. Tests cover the new detection path

### Extracting shared logic
When extracting helpers to `agents/helpers.ts`:
1. Export the function
2. Update imports in all consumers
3. Add unit tests for the extracted function

### Restructuring agents
If splitting or merging agents:
1. Update `allAgents()` in `src/core/agents/index.ts`
2. Ensure no feature category is left unanalyzed
3. Verify recommendation deduplication still works (keyed by `featureID`)

## After Refactoring

1. Run `npx jest --no-coverage` — all tests must pass
2. Run `npx tsc --noEmit` — no type errors
3. Verify no dead `knownHints` or unreachable `detectHints` were introduced
