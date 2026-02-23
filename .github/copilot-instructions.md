# Copilot Instructions for This Project

You are working on a VS Code extension written in TypeScript. Follow these conventions and architectural patterns when proposing changes.

## Project Snapshot
- TypeScript targeting VS Code ^1.85.0; entry point: src/extension.ts, output: out/
- Core logic under src/core (analyzer, agents, feature catalog, prompts, report, scanner)
- Views under src/views (webviews, tree providers); tests under src/test (Jest)
- Packaging: exclude docs/media/test/src maps via .vscodeignore; main commands: analyze, scorecard, export report, feature catalog, implement, show me

## Language & Style
- Use TypeScript with ES2020+ syntax; prefer `const`/`let`, no `var`; keep semicolons
- Import paths are relative; avoid `any` when possible; keep types explicit on public APIs
- Keep functions small and focused; prefer pure helpers for logic and thin wrappers for VS Code API
- Webviews: keep HTML/CSS inline in view files; escape user content (use provided `escapeHtml` helpers where available)

## Architecture Patterns
- Agents live in src/core/agents; feature metadata in src/core/featureCatalog and src/core/features
- Prompts/system/tutorial text in src/core/prompts; registry in src/core/features/registry
- Scanner reads settings/logs/workspace/extensions via helpers in src/core/scanner
- Views (dashboard/settings/tree) consume AnalysisResult and feature catalog; keep UI updates isolated to view classes

## Error Handling
- Default to fail fast: throw on unexpected states, invalid feature IDs, or missing data instead of silently continuing
- For user-facing operations, surface errors via VS Code notifications (`showErrorMessage`) when appropriate, but do not swallow stack traces in core logic
- Guard VS Code API access in tests with try/catch or mocks to keep unit tests stable

## Testing Expectations
- Add/adjust Jest tests in src/test for new logic; prefer deterministic data and explicit expectations
- Mock VS Code APIs in tests using jest.mock with virtual modules
- Keep tests focused on behavior (inputs/outputs) rather than internal implementation details

## Coding Tasks Copilot Should Prefer
- Add commands/view updates by modifying package.json contributes; keep titles consistent with docs
- Extend feature definitions via src/core/features and registry; ensure IDs are unique and docsURL present
- Update prompts/tutorials in src/core/prompts when adding implementable/tutorial flows
- Keep .vscodeignore exclusions intact when suggesting packaging changes

## Quality Bar
- Run `npm run lint` and `npm test` for changed areas
- Maintain existing naming conventions (`Feature`, `AnalysisResult`, etc.) and keep files ASCII
- Write concise comments only for non-obvious logic
