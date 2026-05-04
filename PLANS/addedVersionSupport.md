# Plan: Per-Feature `addedIn` Version + Availability Badges

Add an `addedIn` semver field to every feature definition, compare it against the user's running VS Code (`vscode.version`), and surface badges — **"Requires VS Code v1.X+"** for not-yet-available features and **"New"** for features matching the latest reviewed version. Introduce a `copilotEnabler.latestVersionChecked` setting (default `1.110.0`) for the agentic auto-update workflow, and retire `latest-version-support.json`.

---

## Phase 1 — Schema + version helpers (foundation)

1. **Extend the feature schema.**
   - In [src/core/featureCatalog.ts](src/core/featureCatalog.ts) — add a required `addedIn: string` (semver `MAJOR.MINOR.PATCH`) to the `Feature` interface.
   - In [src/core/features/definition.ts](src/core/features/definition.ts) — `FeatureDefinition` inherits the new field automatically; no separate addition needed.

2. **Add version-comparison + availability helpers** in [src/core/featureCatalog.ts](src/core/featureCatalog.ts):
   - `compareVersions(a, b)` — pure helper that parses `MAJOR.MINOR.PATCH`, ignores `-insiders`/build suffixes, returns `-1 | 0 | 1`. Falls back to string compare if either side is malformed.
   - `getRunningVscodeVersion(): string | undefined` — wraps `require('vscode').version`, returns `undefined` outside the host (tests).
   - `getLatestVersionChecked(): string` — reads `copilotEnabler.latestVersionChecked`, defaults to `'1.110.0'`.
   - `getFeatureAvailability(feature): 'available' | 'new' | 'unavailable'`
     - `unavailable` if running version is known and `addedIn > running`.
     - `new` if `addedIn` matches the running version on `MAJOR.MINOR` (so `1.110.2` user still sees `1.110.0` features as new).
     - `available` otherwise. When running version is unknown (test env), always `available`.

3. **`visibleCatalog()` keeps returning all features.** No version filtering — the user explicitly wants unavailable features visible-with-badge. Hidden-feature filter is unchanged.

4. **Add the new VS Code setting** in [package.json](package.json) under `contributes.configuration.properties`:
   - `copilotEnabler.latestVersionChecked` — `type: "string"`, `default: "1.110.0"`, description noting it's the most recent VS Code release the catalog has been reconciled against (used by the auto-update workflow).

---

## Phase 2 — Backfill `addedIn` on existing features (parallel with Phase 3)

5. **Set `addedIn: '1.110.0'`** on every existing feature file (28 files) under [src/core/features/core](src/core/features/core), [src/core/features/tools](src/core/features/tools), [src/core/features/customization](src/core/features/customization). Single-line addition, no other edits.

6. **Update [src/core/features/_template.ts](src/core/features/_template.ts)** to include `addedIn: '1.110.0'` as a documented field with a comment pointing at `copilotEnabler.latestVersionChecked`.

---

## Phase 3 — Views render badges (parallel with Phase 2)

7. **[src/views/featureTreeProvider.ts](src/views/featureTreeProvider.ts):** In `FeatureItem` and `CategoryItem`, call `getFeatureAvailability(feature)` and:
   - `unavailable` → prepend `Requires v{addedIn}+` to `description`, use a muted icon (`circle-slash`), set `contextValue` to `featureUnavailable` so the existing hide/implement context items don't apply.
   - `new` → append `· New` to `description`, use `sparkle` (or `star-full`) icon when not detected, keep `check` when used.
   - `available` → unchanged from today.
   - `CategoryItem` ratio (`used/detectable`) excludes unavailable features.

8. **[src/views/dashboardPanel.ts](src/views/dashboardPanel.ts):** In the feature-card HTML rendering loop near line 471, add a small pill (`<span class="badge badge-new">New</span>` / `<span class="badge badge-locked">Requires v1.X+</span>`). Reuse the existing `escapeHtml` helper. Keep the badge styles inline alongside existing CSS.

9. **[src/views/recommendationTree.ts](src/views/recommendationTree.ts):** Suppress recommendations for `unavailable` features (they aren't actionable), but tag `new` ones with the `· New` suffix on `description`.

---

## Phase 4 — Analyzer excludes unavailable features

10. **[src/core/analyzer.ts](src/core/analyzer.ts):** When computing `detectableCount` (around line 79), additionally filter out `unavailable` features so the score isn't dragged down by features the user can't run yet. Pass the filtered list into `AnalysisContext.featureCatalog` so agents under [src/core/agents](src/core/agents) (`adoption`, `modes`, `customizations`) only score against available features.

---

## Phase 5 — Tooling + cleanup (parallel after Phase 1)

11. **Delete [latest-version-support.json](latest-version-support.json)** at repo root. No references in `src/`; safe to remove. (Hard-to-reverse — confirm before executing in implementation phase.)

12. **[scripts/new-feature.js](scripts/new-feature.js):**
    - Add an `Added in version (e.g., 1.111.0):` prompt with default `1.110.0`.
    - Inject `addedIn: '<version>',` into the generated definition.
    - Validate the answer matches `^\d+\.\d+\.\d+$`; re-prompt on failure.

---

## Phase 6 — Tests

13. **[src/test/featureCatalog.test.ts](src/test/featureCatalog.test.ts):**
    - Assert every feature has a non-empty `addedIn` matching `^\d+\.\d+\.\d+$`.
    - New `describe('version helpers')` block exercising `compareVersions` (equal, less, greater, malformed, insiders suffix).
    - Mock `vscode.version` via the existing `jest.mock('vscode', …, { virtual: true })` and assert `getFeatureAvailability` returns `available` / `new` / `unavailable` correctly.
    - Mock `copilotEnabler.latestVersionChecked` returning a custom value via `getConfiguration`.

14. **[src/test/featureCatalog.test.ts](src/test/featureCatalog.test.ts):** Confirm `visibleCatalog()` still returns the full set regardless of `addedIn`.

15. **[src/test/agents.test.ts](src/test/agents.test.ts) / [src/test/adoption.test.ts](src/test/adoption.test.ts):** If fixtures construct minimal `Feature` objects inline, add `addedIn: '1.110.0'` to satisfy the new required field. Otherwise no change.

---

## Relevant files

- [src/core/featureCatalog.ts](src/core/featureCatalog.ts) — add `addedIn` to `Feature`, add helpers `compareVersions` / `getRunningVscodeVersion` / `getLatestVersionChecked` / `getFeatureAvailability`.
- [src/core/features/definition.ts](src/core/features/definition.ts) — inherits new field; no code change but verify type flows.
- [src/core/features/_template.ts](src/core/features/_template.ts) — document and include `addedIn`.
- [src/core/features/core/*.ts](src/core/features/core), [src/core/features/tools/*.ts](src/core/features/tools), [src/core/features/customization/*.ts](src/core/features/customization) — add `addedIn: '1.110.0'`.
- [src/core/analyzer.ts](src/core/analyzer.ts) — exclude unavailable features from detectable/scoring set.
- [src/views/featureTreeProvider.ts](src/views/featureTreeProvider.ts) — badge rendering on tree items, ratio adjustment.
- [src/views/dashboardPanel.ts](src/views/dashboardPanel.ts) — badge rendering in webview HTML.
- [src/views/recommendationTree.ts](src/views/recommendationTree.ts) — suppress unavailable recommendations, tag new ones.
- [package.json](package.json) — add `copilotEnabler.latestVersionChecked` configuration property.
- [scripts/new-feature.js](scripts/new-feature.js) — prompt for `addedIn`.
- [src/test/featureCatalog.test.ts](src/test/featureCatalog.test.ts) — version helper + availability tests.
- [latest-version-support.json](latest-version-support.json) — delete.

---

## Verification

1. `npm run lint` — passes (no `any`, semicolons, relative imports).
2. `npm test` — all suites pass; new version-helper tests cover `available` / `new` / `unavailable` branches and malformed semver.
3. Manual: `npm run installextension`, then in a VS Code 1.110 build:
   - Sidebar feature tree shows existing features without "Requires" or "New" badges (running version equals `addedIn`).
   - Temporarily set one feature's `addedIn` to `1.999.0` → confirm tree renders `Requires v1.999.0+` and recommendations omit it.
   - Set `copilotEnabler.latestVersionChecked` to `1.110.0` and a feature's `addedIn` to `1.110.0` → confirm `· New` badge appears in tree and dashboard webview.
4. `cat package.json | jq '.contributes.configuration.properties."copilotEnabler.latestVersionChecked"'` — confirms the new setting is registered with default `"1.110.0"`.
5. `git status` — confirms `latest-version-support.json` is deleted and 28 feature files have a single-line `addedIn` addition.

---

## Decisions

- **Field name:** `addedIn` (e.g., `addedIn: '1.110.0'`).
- **Source of truth for "available":** `vscode.version` (running VS Code), via dynamic `require('vscode')` to stay test-friendly.
- **Behavior for unavailable features:** Show in feature catalog tree + dashboard with `Requires v{addedIn}+` badge; **omit from recommendations** (not actionable); **exclude from detectable / scoring base** in analyzer.
- **"New" definition:** Feature whose `addedIn` matches the running VS Code on `MAJOR.MINOR`. (Tolerates `.patch` differences like `1.110.0` vs `1.110.2`.)
- **`copilotEnabler.latestVersionChecked`:** New string setting, default `1.110.0`. Used by the future agentic auto-update workflow as a watermark for "what versions of VS Code we've reconciled against." Not consumed by the badge logic itself in this iteration.
- **`latest-version-support.json`:** Deleted. Replaced by the setting.
- **Hidden-feature filter:** Unchanged. Hidden + unavailable are independent dimensions.

---

## Further Considerations

1. **Should the "New" badge also key off `latestVersionChecked` instead of running version?** Right now it keys off the running VS Code so users always see what's new in *their* build. Alternative: only mark `New` when `addedIn === latestVersionChecked` so contributors control the badge centrally. — *Recommendation: ship the running-version variant; add the watermark variant later if noisy.*
2. **Score impact of excluding unavailable features.** Excluding them from the detectable count means a user on an older VS Code sees a higher score than a newer-build user with the same setup. Acceptable trade-off (don't penalize), but worth calling out in release notes.
3. **`addedIn` validation at registry-load time.** Adding a lightweight `validateFeatureDefinitions()` invocation inside `getFeatureDefinitions()` (throw on malformed `addedIn`) would catch contributor mistakes early. Optional — could ship without it.
