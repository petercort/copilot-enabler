# Remove Export Feature Plan

## Goal
Retire the **Export Report** feature from the extension so it is no longer available in commands, UI surfaces, documentation, or tests.

## Scope
- Remove the `copilotEnabler.exportReport` command from activation and command registration.
- Remove all `package.json` contributions tied to export (commands, menus, keybindings, command palette entries).
- Remove export handler logic and any now-unused report-generation imports/functions.
- Update docs and tests that reference export behavior.
- Verify the workspace remains healthy with linting and tests.

## Step-by-Step Plan

1. **Inventory all usages**
   - Search for `copilotEnabler.exportReport`, `handleExportReport`, and report-generation references.
   - Capture affected files in `src/`, `package.json`, `README.md`, and `src/test/`.

2. **Remove command wiring in extension entrypoint**
   - Edit `src/extension.ts` to remove:
     - command registration for export,
     - `handleExportReport` invocation path,
     - now-unused imports related to markdown report generation.

3. **Prune command contributions**
   - Edit `package.json` to remove `copilotEnabler.exportReport` from:
     - `contributes.commands`,
     - `contributes.menus` (any surface),
     - `contributes.keybindings` (if present).
   - Ensure JSON remains valid and consistent.

4. **Delete dead export logic**
   - Remove export-only helpers/functions no longer used after command removal.
   - Keep changes minimal and avoid unrelated refactors.

5. **Update docs and tests**
   - Remove or revise export mentions in `README.md` and any docs under `docs/`.
   - Update Jest tests that assert export command presence or behavior.

6. **Validate changes**
   - Run `npm run lint`.
   - Run `npm test`.
   - Resolve issues caused by export removal only.

## Acceptance Criteria
- No runnable `Export Report` command remains.
- No `copilotEnabler.exportReport` references remain in command contributions.
- `src/extension.ts` has no export handler wiring.
- Documentation and tests no longer imply export support.
- Lint and tests pass (or failures are confirmed unrelated).