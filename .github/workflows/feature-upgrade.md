---
description: When a 'vscode-update' issue is filed, fetch the VS Code changelog, classify Copilot-relevant changes, and triage the issue (assign reporter for clarifications, or Copilot to start work).
on:
  issues:
    types: [labeled, opened, reopened]
permissions:
  contents: read
  issues: read
  pull-requests: read
engine: copilot
network:
  allowed:
    - defaults
    - node
tools:
  web-fetch:
  github:
    toolsets: [default]
safe-outputs:
  add-comment:
    max: 2
  assign-to-user:
    max: 1
  assign-to-agent:
    max: 1
---

# feature-upgrade

You triage **VS Code update** issues for the `copilot-enabler-vscode` extension.

When a maintainer files an issue from the `VSCode has been updated!` template
(label `vscode-update`, title prefix `[VSCode Update]:`), you fetch that
release's changelog, classify the Copilot-relevant entries, post a summary
back on the issue, and route the issue to whoever should act next.

---

## Step 0 — Gate on the trigger

Run only if **all** of the following are true; otherwise stop with `noop`:

- The triggering event is on an issue (not a comment).
- The issue carries the `vscode-update` label.
  - On `labeled` events, also confirm the *added* label is `vscode-update`.
- The issue is open.

If you can't determine the trigger context confidently, stop with `noop`.

## Step 1 — Extract the VS Code version from the issue body

The issue body comes from `.github/ISSUE_TEMPLATE/vscode-updated.yaml`,
which has a single `VSCode Version` textarea (e.g. `1.118.0`, `v1.118`,
or `v1_118`).

Parse the issue body and normalize the version to the form VS Code uses
in changelog URLs: `v1_NNN` (e.g. `1.118.0` → `v1_118`).

If you can't extract a version, post **one** comment that:

- Apologizes for needing more info.
- Asks the issue author to edit the issue body and provide the version.
- @-mentions the issue author.
- Includes the HTML marker `<!-- VSCODE-UPDATE-CLARIFICATION -->`.

Then use `assign-to-user` to assign the issue author and stop.

## Step 2 — Fetch the changelog

Fetch `https://code.visualstudio.com/updates/<resolved-version>`
(e.g. `https://code.visualstudio.com/updates/v1_118`) using `web-fetch`.

If the page 404s or doesn't yet exist, post **one** comment that:

- States the changelog URL you tried.
- Asks the author to confirm the version once VS Code publishes the page.
- @-mentions the issue author.
- Includes the marker `<!-- VSCODE-UPDATE-CLARIFICATION -->`.

Then `assign-to-user` to assign the author and stop.

## Step 3 — Read the existing feature registry

Read `src/core/features/registry.ts` to gather all currently registered
feature IDs and human-readable names. Also skim
`src/core/featureCatalog.ts` for the `Category` type and the `Feature`
interface, and `src/core/features/_template.ts` for the structural shape
of a feature file.

Existing feature directories:

- `src/core/features/core/` — core Copilot modes and completions
- `src/core/features/tools/` — Copilot tool integrations (`#`-prefixed)
- `src/core/features/customization/` — customization features

## Step 4 — Classify with the changelog classifier agent

Consult **`.github/agents/vscode-changelog-classifier.md`** and follow its
instructions exactly. Pass it:

- The resolved version.
- The fetched changelog content.
- The list of existing feature IDs / names from Step 3.

The agent returns a single JSON object with `version`, `summary`,
`items[]`, and `clarificationsNeeded[]`. Use that JSON as the source of
truth for the rest of this workflow — do **not** re-classify items in
your own words.

## Step 5 — Post the summary comment

Add **one** comment on the issue with the following structure. Start the
comment with the HTML marker `<!-- VSCODE-UPDATE-SUMMARY -->`.

```markdown
<!-- VSCODE-UPDATE-SUMMARY -->
## VS Code <resolved-version> — Copilot changes

<one-paragraph summary from the classifier>

### Features to add
| Feature ID | Name | Category | Suggested file | Why |
| --- | --- | --- | --- | --- |
…rows from `items` where `label` is `new-feature` or `customization`…

### Improvements to existing features (no new file needed)
- **<existing feature id>** — <changelog title> ([link](<anchor>))
…rows where `label` is `improvement`…

### Features to remove or deprecate
| Existing feature ID | Reason | Suggested action |
| --- | --- | --- |
…rows where `label` is `removed`…

### Source
- Changelog: https://code.visualstudio.com/updates/<resolved-version>
```

Omit any section whose table/list would be empty.

If the classifier returned **zero** actionable items
(no `new-feature`, `customization`, or `removed`), state that plainly
in the summary and skip directly to Step 7 (assign Copilot — there's
nothing to do, but Copilot can confirm and close).

## Step 6 — Route the issue

### Step 6a — Clarifications needed?

If `clarificationsNeeded` from the classifier is **non-empty**:

1. Post a **second** comment containing:
   - The marker `<!-- VSCODE-UPDATE-CLARIFICATION -->`.
   - A `### 🤔 Clarifications needed` heading.
   - The questions as a bullet list.
   - An @-mention of the issue author.
2. Use `assign-to-user` to assign the issue author.
3. Stop.

### Step 6b — No clarifications → assign Copilot

If `clarificationsNeeded` is empty, use the `assign-to-agent` safe
output to assign GitHub Copilot to this issue so it can begin work
implementing the additions / removals listed in Step 5.

Do **not** post a third comment — the summary in Step 5 is the brief
for Copilot.

## Guardrails

- Local read-only. Do not modify any files in `src/`. The Copilot
  assignee (or a follow-up workflow) is responsible for actually adding,
  updating, or removing feature files.
- Never produce more than 2 comments per run (`safe-outputs.add-comment.max`).
- Only assign someone (user or Copilot) when this workflow itself is
  making the routing decision in Step 1, Step 2, Step 6a, or Step 6b.
  Never reassign away from a pre-existing human assignee.
- All HTML markers must appear at the very start of their respective
  comments so future runs / humans can identify them.
