---
description: "Use when writing TypeScript, implementing VS Code extension APIs, or building webview UI. Covers TypeScript best practices, VS Code extension patterns, and webview/HTML/CSS guidelines for this codebase."
applyTo: "src/**"
---
# TypeScript, VS Code Extension & UI Guidelines

## TypeScript

- Use ES2020+ syntax; target is set in `tsconfig.json`
- Always `const`/`let`; never `var`
- Explicit types on all public APIs; avoid `any` — use `unknown` + type narrowing when the type is genuinely dynamic
- Prefer small, single-purpose functions with descriptive names
- Relative imports only; no path aliases; keep files ASCII; semicolons required

## VS Code Extension Patterns

- Register commands in **both** `src/extension.ts` (push to subscriptions) **and** `package.json` → `contributes.commands`
- Command IDs are namespaced `copilotEnabler.*`; titles must be prefixed `Copilot Enabler:`
- Read settings via `vscode.workspace.getConfiguration('copilotEnabler')`; declare new settings in `package.json` → `contributes.configuration.properties` with a `description`
- Fail fast on invalid states in `src/core`; surface user-facing errors with `vscode.window.showErrorMessage` — do not swallow stack traces
- Scanners in `src/core/scanner/` must be **read-only and local** — no network calls, no file writes, return typed result objects

## Webview / UI

- HTML and CSS are **inline** inside each view file in `src/views/` — no separate asset files
- Webview scripts must be **browser-safe**: no Node.js APIs (`require`, `fs`, `path`, etc.)
- Escape all user-derived content before inserting into HTML; use the `escapeHtml` helpers where available
- Keep views as thin consumers of data (`AnalysisResult`, `PromptimizerResult`); business logic belongs in `src/core`
- Use `postMessage` / `onDidReceiveMessage` for all host ↔ webview communication

## Quality Bar

- Run `npm run lint` and `npm test` after any change under `src/`
- Add or adjust Jest tests in `src/test/` when behavior changes; mock VS Code APIs with `jest.mock('vscode', () => ..., { virtual: true })`
