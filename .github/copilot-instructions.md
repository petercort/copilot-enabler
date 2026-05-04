# Copilot Instructions for This Project

VS Code extension (TypeScript, `engines.vscode: ^1.85.0`) that analyzes Copilot adoption. Entry point: `src/extension.ts`, compiled to `out/` via `tsc -p ./`.

## Commands

| Task | Command |
|---|---|
| Compile | `npm run compile` (or `npm run watch`) |
| Lint | `npm run lint` (ESLint flat config in `eslint.config.mjs`, scoped to `src/`) |
| All tests | `npm test` (Jest + ts-jest) |
| Single test file | `npx jest src/test/<name>.test.ts` |
| Single test by name | `npx jest -t "<test name>"` |
| Scaffold a feature | `npm run new-feature` (interactive; see caveats below) |
| Package & install VSIX | `npm run installextension` (runs `vsce package` + `code --install-extension`) |

Run `npm run lint && npm test` after any change in `src/`.

## Architecture — the big picture

Data flows in one direction: **scanners → analyzer → agents → recommendations → views**.

1. **Scanners** (`src/core/scanner/{settings,workspace,extensions,logs}.ts`) read local-only data: VS Code settings (`github.copilot.*`), workspace files (`.github/copilot-instructions.md`, `.vscode/mcp.json`, prompts, skills, hooks), installed extensions, and Copilot log files. They return plain `*Result` objects — no VS Code UI calls.
2. **`runAnalysis`** (`src/core/analyzer.ts`) assembles an `AnalysisContext`, runs every agent in `src/core/agents` (adoption, modes, customizations), and merges their `AgentReport`s into a single `AnalysisResult` (score, used/unused features, `topRecommendations`, `logSummary`, `staticFindings`).
3. **Features** are defined as `FeatureDefinition` objects (`src/core/features/definition.ts`) in per-feature files under `src/core/features/{core,tools,customization}/`, then aggregated in `src/core/features/registry.ts` and exposed via `src/core/featureCatalog.ts` (`visibleCatalog()` filters out user-hidden IDs from the `copilotEnabler.hiddenFeatures` setting). A feature bundles metadata, detect hints, setup steps, and optional `systemPrompt` / `tutorialPrompt`.
4. **Prompts** (`src/core/prompts.ts`) export `implementableFeatures`, `systemPrompts`, `tutorialPrompts` — derived from feature definitions and consumed by the `implement` / `showMe` commands, which open a Copilot Chat session with the tailored prompt.
5. **Views** (`src/views/*`): `DashboardPanel` + `SettingsPanel` (webviews with inline HTML/CSS), `FeatureTreeProvider` / `RecommendationTreeProvider` / `PromptimizerTreeProvider` (sidebar trees), `StatusBarManager`. Views are pure consumers of `AnalysisResult` / `PromptimizerResult`.
6. **Promptimizer** (`src/core/promptimizer/*`) is an independent subsystem: ingests prompt logs (JSONL/HAR/Copilot Chat traces), classifies blocks, tokenizes (heuristic), runs rule engine (`recommend/`), and estimates `$/100 turns`. Wired through `runPromptimizer()` + `PromptimizerPanel` + `PromptimizerWatcher` (file watcher for large tool results).

## Key conventions

- **Adding a feature:** prefer `npm run new-feature` to scaffold `src/core/features/<cat>/<cat>-<id>.ts` and patch `registry.ts`. The registry uses `// ── END IMPORTS ──` and category section markers — do not remove them. Feature `id` must be unique and kebab-case; `docsURL` is required.
- **Adding a command:** register in `src/extension.ts` AND add the matching entry to `contributes.commands` in `package.json`. Command IDs are namespaced `copilotEnabler.*`. Keep command titles prefixed with `Copilot Enabler:` and consistent with `README.md`.
- **Adding a setting:** add to `contributes.configuration.properties` in `package.json` with a `description`; read via `vscode.workspace.getConfiguration('copilotEnabler')`.
- **Webview HTML/CSS is inline** in each view file — escape any user-derived content (use the `escapeHtml` helpers where available). Do not assume Node APIs inside webview scripts; keep them browser-safe.
- **Scanners must stay read-only and local** — nothing is ever sent off-machine. If you need new data, add a helper in `src/core/scanner/` returning a typed result object.
- **Fail fast** on invalid feature IDs or unexpected states in core logic; surface user-facing errors at the command/view layer with `vscode.window.showErrorMessage`. Do not swallow stack traces in `src/core`.
- **TypeScript:** ES2020+, semicolons, `const`/`let`, explicit types on public APIs, avoid `any`. Relative imports only. Keep files ASCII.

## Tests

- Jest config is in `jest.config.js`; tests live in `src/test/*.test.ts` and run under `ts-jest` in `node` env.
- VS Code APIs are mocked with `jest.mock('vscode', () => ..., { virtual: true })` — follow the pattern in existing tests (`scanner.test.ts`, `agents.test.ts`).
- Prefer deterministic fixtures; assert on returned data structures, not implementation details.

## Packaging

- `.vscodeignore` excludes `src/`, `test/`, `scripts/`, `docs/`, `.github/`, `*.map`, etc. Do not add dev/test artifacts to the VSIX. `main` must remain `./out/extension.js`.

## Response discipline for large tool output

When a single tool result exceeds ~200 lines (≈3000 tokens):
1. Summarize findings in ≤10 bullets and discard the raw output — do not quote it back.
2. Prefer bounded reads: `view` with `view_range`, `grep` with `head_limit`, pipe to `head`/`tail`, or `rg --max-count`.
3. If a read/grep still dumps too much, narrow the query and retry rather than accepting the dump.