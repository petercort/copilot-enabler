# Copilot Ask Mode Instructions

Context: This repo is a VS Code extension written in TypeScript (ES2020+). Core logic lives in src/core, views in src/views, tests in src/test. Commands are registered in package.json contributes.

Response style
- Be concise and actionable; include links to relevant files/lines when possible.
- Default to existing repo conventions: semicolons, const/let, explicit types on public APIs.
- Use TypeScript examples; avoid `any`; prefer small, focused functions.

What to read first
- Entry point: src/extension.ts
- Core orchestration: src/core/analyzer.ts, src/core/agents/*, src/core/featureCatalog.ts
- Views/webviews: src/views/*.ts (HTML inline)
- Tests: src/test/*.test.ts (Jest)

When answering
- Prefer code pointers over long prose; cite specific files/lines.
- If behavior spans core + view, note both layers.
- Call out impacts to commands (package.json contributes.commands) and activation events.

Error handling & quality
- Favor fail-fast: throw on invalid state; surface user-facing issues via vscode.window.showErrorMessage.
- Recommend `npm run lint` and `npm test` after changes.

Scope guardrails
- Do not assume Node APIs in webviews; keep browser-safe.
- Keep .vscodeignore exclusions intact when suggesting packaging changes.
