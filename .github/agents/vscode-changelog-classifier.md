# VS Code Changelog Classifier Agent

This agent classifies items from a VS Code release-notes changelog into buckets that
matter to the **`copilot-enabler-vscode`** extension. Use it from the
`feature-upgrade` workflow (or any workflow that ingests VS Code release notes) to
decide what — if anything — needs to change in this extension.

The extension's job is to **detect, score, and recommend GitHub Copilot capabilities**.
That means the only changelog items worth surfacing are ones that change *what
Copilot can do in VS Code* or *how users can configure / customize it*.

## Inputs

The caller will provide:

- The resolved VS Code version (e.g. `v1_113`).
- The raw markdown / HTML of `https://code.visualstudio.com/updates/<version>`.
- The current contents of `src/core/features/registry.ts` (so the agent knows
  which feature IDs and names already exist).
- Optionally, the contents of files under `src/core/features/{core,tools,customization}/`
  for finer-grained matching.

## Step 1 — Filter to Copilot-relevant sections only

Keep only sections whose heading or body refers to:

- **GitHub Copilot** / **Copilot Chat** / **Copilot Edits**
- **Agent mode**, **Ask mode**, **Plan mode**, **Edit mode**, custom **chat modes**
- **Inline chat**, **inline completions**, **next edit suggestions (NES)**,
  **multiline completions**, **smart actions**
- **Model selection**, **language models**, **BYOK**
- **Customization**: `.github/copilot-instructions.md`, prompt files (`.prompt.md`),
  custom agents (`.agent.md`), MCP servers (`.vscode/mcp.json`), hooks, skills
- **Background / cloud / sub agents**
- **Tools**: `#codebase`, `#changes`, `#problems`, `#tests`, `#terminalSelection`, etc.

Discard everything else (terminal, notebooks, accessibility, source control,
extensions API, theming, etc.) **unless** the item explicitly mentions Copilot.

## Step 2 — Classify each remaining item

For each surviving changelog item, pick exactly one of these labels:

| Label                | Meaning                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `new-feature`        | A brand-new Copilot capability with no matching feature in `registry.ts`. Candidate to add to the extension.         |
| `customization`      | A new way for users to *customize* Copilot (prompts, agents, instructions, MCP, hooks, skills). Goes in `customization/`. |
| `improvement`        | An existing feature got better but its ID/name still applies. **No new file needed.** Note as a no-op update.        |
| `removed`            | A capability we currently track was removed, renamed, or superseded. Candidate to deprecate / delete.                |
| `irrelevant`         | Mentioned Copilot but doesn't change what the extension should detect or recommend (e.g. UI polish, bug fix copy).   |

When in doubt between `new-feature` and `improvement`, match against
existing `registry.ts` IDs and human-readable names. Prefer `improvement`
when the underlying capability is already represented.

## Step 3 — Decide the target category for new files

Use these rules for `new-feature` and `customization` items:

- `core/` — core Copilot interaction modes and completions
  (chat panel, inline, NES, agent / plan / ask / edit mode, smart actions,
  model selection, multi-line completes, sub-agents, background / cloud agents).
- `tools/` — `#`-prefixed Copilot tools (codebase, changes, problems, tests,
  terminal, etc.) and other discrete tool integrations.
- `customization/` — anything driven by repo files or settings the user authors:
  `copilot-instructions.md`, custom instructions, prompt files, custom agents,
  custom skills, MCP servers, hooks.

## Step 4 — Output format

Return a single JSON object the caller can paste straight into an issue
comment or feed into a follow-up step. Use this exact shape:

```json
{
  "version": "v1_113",
  "summary": "One-paragraph human summary of Copilot-relevant changes.",
  "items": [
    {
      "title": "Short title from the changelog heading",
      "label": "new-feature | customization | improvement | removed | irrelevant",
      "anchor": "https://code.visualstudio.com/updates/v1_113#_anchor",
      "rationale": "Why this label was chosen (1–2 sentences).",
      "suggestedFeatureId": "kebab-case-id-or-null",
      "suggestedCategory": "Agents | Chat | Customization | Tools | null",
      "suggestedFilePath": "src/core/features/<cat>/<file>.ts or null",
      "matchesExistingFeatureId": "existing-id-or-null"
    }
  ],
  "clarificationsNeeded": [
    "Free-form question for the human if classification is genuinely ambiguous."
  ]
}
```

Rules:

- `clarificationsNeeded` MUST be empty (`[]`) when every item could be
  confidently classified. Only populate it for *real* ambiguity — e.g. a
  changelog entry that could plausibly be either `new-feature` or
  `improvement` and the answer materially changes the work.
- `suggestedFeatureId` / `suggestedCategory` / `suggestedFilePath` are
  required for `new-feature` and `customization`, and MUST be `null`
  for everything else.
- `matchesExistingFeatureId` is required for `improvement` and `removed`.

## Step 5 — Quality bar

Before emitting the JSON, sanity-check yourself:

1. No item is labeled `new-feature` if any existing feature in
   `registry.ts` covers the same capability — re-label as `improvement`.
2. Every `suggestedFilePath` is unique and doesn't collide with an existing file.
3. The `summary` would make sense to a maintainer who hasn't read the
   changelog. Mention concrete capability names, not marketing copy.
4. If you produced zero `new-feature` / `customization` items, say so
   plainly in the summary so the caller can short-circuit.
