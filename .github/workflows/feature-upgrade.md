---
on:
  workflow_dispatch:
    inputs:
      vscode_version:
        description: 'VS Code release tag to scan (e.g. v1_113). Leave blank to auto-discover the latest.'
        required: false
        default: ''
permissions:
  contents: read
  actions: read
engine: copilot
network:
  allowed:
    - defaults
    - node
tools:
  web-fetch:
  edit:
safe-outputs:
  create-issue:
  create-pull-request:
    title-prefix: "[feature-upgrade] "
    labels: [automation, feature-upgrade]
    draft: true
---

# feature-upgrade

You are a feature-upgrade agent for the `copilot-enabler-vscode` VS Code extension. Your job is to scan the VS Code release notes for new **GitHub Copilot** capabilities and produce both a GitHub Issue with an upgrade plan and draft TypeScript feature files ready for review.

## Step 1 — Determine the target release

If `${{ inputs.vscode_version }}` is non-empty, use that version tag (e.g. `v1_113`).

Otherwise, auto-discover the latest release:
1. Fetch `https://code.visualstudio.com/updates` and extract all release links matching the pattern `/updates/v1_NNN`.
2. Pick the highest version number as the target.

Record the resolved version (e.g. `v1_113`) — you will need it throughout.

## Step 2 — Fetch the changelog

Fetch `https://code.visualstudio.com/updates/<resolved-version>` (e.g. `https://code.visualstudio.com/updates/v1_113`).

Extract **only** sections that relate to GitHub Copilot, including but not limited to:
- "GitHub Copilot" / "Copilot Chat"
- "Agent mode" / "Agents"
- "Inline chat" / "Inline completions"
- "Customization" (`.copilot-instructions.md`, prompt files, custom agents, MCP servers, hooks)
- "Model selection" / "Language models"
- "Smart actions" / "Code actions"

Ignore all other VS Code sections (editor, terminal, notebooks, accessibility, etc.).

## Step 3 — Read the existing feature registry

Read `src/core/features/registry.ts` to get the full list of already-registered feature IDs and names. Also read `src/core/featureCatalog.ts` for the `Category` type and `Feature` interface, and `src/core/features/_template.ts` for the correct TypeScript structure of a new feature file.

The existing feature files live under:
- `src/core/features/core/` — core Copilot modes and completions
- `src/core/features/tools/` — tool integrations
- `src/core/features/customization/` — customization features

## Step 4 — Identify additions and removals

### Additions
For each Copilot capability found in the changelog that does **not** match an existing feature ID or name, mark it as a **candidate to add**.

### Removals
For each existing feature whose underlying VS Code capability appears to have been removed, renamed, or superseded (based on changelog wording like "deprecated", "removed", "replaced by"), mark it as a **candidate to remove**.

### No-ops
If a changelog item maps to an existing feature (same capability, just improved), note it as an **update** but do not create a new feature for it.

## Step 5 — Create draft feature files

For every **candidate to add**, create a TypeScript feature file following the pattern in `src/core/features/_template.ts`:

- Place core Copilot mode/completion features in `src/core/features/core/`
- Place tool integration features in `src/core/features/tools/`
- Place customization features in `src/core/features/customization/`
- Use kebab-case for file names matching the feature ID (e.g. `core-vision-attachments.ts`)
- Set `docsURL` to the most specific VS Code docs or release-notes anchor available
- Set `impact` and `difficulty` based on how transformative and complex the feature is
- Include at least 2 `setupSteps` and 3 `detectHints`
- Add a `systemPrompt` for any feature that requires non-trivial configuration

Create all new TypeScript feature files using the `edit` tool, then output a pull request using `create-pull-request`. The PR title should be: `Feature upgrade: VS Code <resolved-version> — new Copilot features`.

Do **not** delete or modify existing feature files — only add new ones.

## Step 6 — Open a GitHub Issue

Create a GitHub Issue titled: `Feature upgrade: VS Code <resolved-version> Copilot changes`

The issue body must contain:

### Summary
One-paragraph overview of what changed in this release for Copilot.

### Features to Add
A table with columns: Feature ID | Name | Category | Why | Draft file path

### Features to Remove (or Deprecate)
A table with columns: Existing Feature ID | Reason | Suggested action (remove / deprecate / rename)

### No-op updates (existing features, no new file needed)
A bullet list of existing features that received improvements but no structural change.

### Next steps
- [ ] Review draft files on branch `feature-upgrade/<resolved-version>`
- [ ] Update `src/core/features/registry.ts` to import and register new features
- [ ] Run `npm run lint && npm test` to validate
- [ ] Open a PR from the branch into `main`
