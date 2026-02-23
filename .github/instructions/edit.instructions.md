# Copilot Edit Mode Instructions

Context: VS Code extension in TypeScript; core under src/core, views under src/views, tests in src/test. Use semicolons, const/let, explicit types on public APIs. Webviews keep HTML/CSS inline.

Edit workflow
- Propose multiple options when changes are non-trivial; state trade-offs briefly.
- Prefer minimal diffs; keep functions small and focused.
- Respect existing naming patterns (Feature, AnalysisResult, etc.).

When editing code
- Core logic: route changes through helpers in src/core rather than views where possible.
- Views: escape user content; avoid `any`; keep browser-safe code.
- Commands/activation: update package.json contributes and align labels with docs.

Error handling
- Fail fast on invalid states; surface user-facing errors with vscode.window.showErrorMessage.

Testing & quality
- Add or adjust Jest tests in src/test when behavior changes.
- Run `npm run lint` and `npm test` after edits.

Packaging
- Keep .vscodeignore exclusions intact; do not add dev/test artifacts to the VSIX.
