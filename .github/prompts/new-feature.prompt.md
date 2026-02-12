---
mode: agent
tools: ["create_file", "read_file", "run_in_terminal"]
description: "Scaffold a new Copilot Enabler feature (agent, scanner, catalog entry, view, tests)"
---

# Add New Feature to Copilot Enabler

You are adding a new feature to the Copilot Enabler VS Code extension — a TypeScript project using the VS Code Extension API, Jest for testing, and strict TypeScript.

## Project Architecture

- `src/core/featureCatalog.ts` — Feature registry with `detectHints`, impact/difficulty scoring
- `src/core/scanner/` — Scanners that detect feature usage (logs, settings, workspace, extensions)
- `src/core/agents/` — Analysis agents that evaluate feature adoption
- `src/core/agents/helpers.ts` — Shared helpers: `featureDetected()`, `mergeHints()`, `buildRecommendation()`
- `src/views/` — UI components (tree views, dashboard, status bar)
- `src/test/` — Jest test files mirroring source structure

## Steps

1. **Read existing patterns** — Review the relevant source files to understand current conventions.
2. **Add catalog entry** — Add a `Feature` object to `catalog()` in `featureCatalog.ts` with proper `id`, `category`, `detectHints`, `impact`, `difficulty`, and `setupSteps`.
3. **Add detection** — Ensure `detectHints` strings are in the appropriate scanner:
   - Log-based: add to `knownHints` in `src/core/scanner/logs.ts`
   - Settings-based: verify the settings scanner produces matching keys
   - Workspace-based: add config file patterns to `src/core/scanner/workspace.ts`
   - Extension-based: add extension ID checks to `src/core/scanner/extensions.ts`
4. **Update agents** — If the feature belongs to a new category, create a new agent in `src/core/agents/`.
5. **Add tests** — Write Jest tests in `src/test/adoption.test.ts` following the existing pattern:
   - `detectHintsInText` tests for log-based hints
   - `featureDetected` tests for each detectHint
   - Scanner-source-specific tests
   - End-to-end agent tests
6. **Run tests** — Execute `npx jest --no-coverage` and fix any failures.

## Conventions

- Use `interface` over `type` for object shapes
- Export functions (not classes) for stateless logic
- CamelCase for hints in code, lowercase for matching
- Every `detectHint` must be reachable from at least one scanner
- Features use `impact` (low/medium/high) and `difficulty` (low/medium/high) for matrix scoring
