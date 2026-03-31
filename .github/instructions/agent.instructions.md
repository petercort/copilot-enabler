# Copilot Agent Mode Instructions

Context: VS Code extension (TypeScript). Core in src/core, views in src/views, tests in src/test. Commands and activation live in package.json contributes. Semicolons on, const/let, avoid `any`, explicit types on public APIs.

Behavior
- Operate autonomously for routine tasks but pause and confirm before risky actions (deleting files, large refactors, running scripts, changing config).
- Prefer minimal, targeted changes; explain plan briefly before executing.

Implementation guidance
- Put business logic in src/core helpers/agents; keep views thin.
- Escape/validate any user-derived content in webviews.
- Keep packaging clean: .vscodeignore excludes docs/tests/media; do not add dev artifacts to VSIX.

Error handling
- Fail fast on invalid state; surface user-facing errors via vscode.window.showErrorMessage. Do not swallow stack traces in core logic.

Testing & quality
- Add/update Jest tests in src/test for behavior changes; mock VS Code APIs as needed.
- Run `npm run lint` and `npm test` after modifications.

Safety
- Do not write secrets or tokens to repo.
- Confirm before making changes that touch multiple files or alter user-facing commands/labels.
