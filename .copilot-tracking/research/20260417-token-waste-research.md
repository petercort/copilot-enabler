<!-- markdownlint-disable-file -->

# Task Research Notes: Token Waste Identification and Prompt Optimization

## Research Executed

### File Analysis

- /home/runner/work/copilot-enabler/copilot-enabler/README.md
  - Verified that this extension already scans Copilot-related workspace artifacts including `.github/copilot-instructions.md`, `.github/instructions/*`, `.github/skills/*`, `.github/hooks/*`, and `.vscode/mcp.json`, which makes token-waste auditing a natural fit for the product surface (README.md:75-84).
- /home/runner/work/copilot-enabler/copilot-enabler/.github/copilot-instructions.md
  - Verified repo-wide guidance is intentionally broad and reused across tasks; it includes persistent style, architecture, error-handling, testing, and packaging instructions, which are candidate sources of always-on context overhead when tasks are not code edits (.github/copilot-instructions.md:11-41).
- /home/runner/work/copilot-enabler/copilot-enabler/.github/instructions/agent.instructions.md
  - Verified repeated guidance on fail-fast behavior, packaging, and `npm run lint` / `npm test`, creating measurable near-duplicate overlap with other instruction files (.github/instructions/agent.instructions.md:3-23).
- /home/runner/work/copilot-enabler/copilot-enabler/.github/instructions/ask.instructions.md
  - Verified ask-mode guidance repeats style and quality constraints while also favoring concise responses and code pointers; this is useful, but some of it overlaps heavily with always-on repo instructions (.github/instructions/ask.instructions.md:3-27).
- /home/runner/work/copilot-enabler/copilot-enabler/.github/instructions/edit.instructions.md
  - Verified edit-mode guidance repeats context, fail-fast behavior, packaging, and lint/test requirements already present elsewhere (.github/instructions/edit.instructions.md:3-23).
- /home/runner/work/copilot-enabler/copilot-enabler/src/core/features/customization/custom-instructions.ts
  - Verified this project models custom instructions as context that is automatically included in every interaction, which is exactly the class of artifact where token waste matters most (src/core/features/customization/custom-instructions.ts:14-35).
- /home/runner/work/copilot-enabler/copilot-enabler/src/core/features/customization/custom-agent-skills.ts
  - Verified skill descriptions are allowed to auto-load based on relevance, so overly broad descriptions are a direct source of unnecessary context injection (src/core/features/customization/custom-agent-skills.ts:18-32).
- /home/runner/work/copilot-enabler/copilot-enabler/src/core/features/customization/custom-mcp-servers.ts
  - Verified MCP tools are introduced through `.vscode/mcp.json`, and the prompt text emphasizes tool selection and configuration, which makes MCP tool-description verbosity and always-loaded tool surfaces important waste targets (src/core/features/customization/custom-mcp-servers.ts:18-34).
- /home/runner/work/copilot-enabler/copilot-enabler/.github/hooks/prerun.json
  - Verified the repo already uses a hook JSON shape that can drive executable audits of tool usage; currently it logs only `npm run lint` and `npm test` (.github/hooks/prerun.json:1-14).

### Code Search Results

- `token|prompt|context|instruction|memory|skill|tool|applyTo|custom instruction`
  - Found prompt and customization logic in `src/core/features/customization/*`, prompt tests in `src/test/prompts.test.ts`, scanning documentation in `README.md`, and hooks under `.github/hooks/*`.
- `custom-instructions|skills|mcp|hooks|agentic memory|memory|applyTo`
  - Found first-class feature definitions for custom instructions, agent skills, MCP servers, and hooks in `src/core/features/customization/` plus existing hook automation in `.github/hooks/prerun.json` and `.github/hooks/scripts/log-tool-use.sh`.
- fuzzy overlap scan across instruction files
  - Verified near-duplicate instructions across repo guidance, including repeated lint/test guidance in `.github/copilot-instructions.md:40`, `.github/instructions/agent.instructions.md:19`, `.github/instructions/ask.instructions.md:23`, and `.github/instructions/edit.instructions.md:20`; repeated packaging guidance around `.vscodeignore`; and repeated fail-fast / `showErrorMessage` guidance.
- lexical relevance experiment
  - Measured Jaccard overlap between the issue task and sample injected contexts: `relevant_instruction=0.061`, `broad_style_instruction=0.024`, `unrelated_codebase_context=0.025`. This showed a broad style/persona block can be almost as lexically unrelated to the task as plainly irrelevant codebase context.
- duplication overhead experiment
  - Measured a synthetic prompt where repeated role/style boilerplate increased word count from `20` to `26` while raising duplicate-word ratio from `0.000` to `0.308`, showing direct overhead with no new task signal.
- topic drift experiment
  - Measured sample turn similarity and saw low overlap once the topic changed from prompt optimization to a VS Code tree-view bug (`turn2-turn3=0.037`), supporting a conversation-reset heuristic when topic nouns and verbs change sharply.

### External Research

- #githubRepo:"github/github-copilot token prompt context instructions"
  - Not executed successfully in this sandbox: outbound network and GitHub API access for repository research were unavailable, so no external repository claims are included from this source.
- #githubRepo:"microsoft vscode copilot customization instructions skills mcp"
  - Not executed successfully in this sandbox: outbound network and GitHub API access were unavailable, so no external repository claims are included from this source.
- #fetch:https://platform.openai.com/docs/guides/prompt-engineering
  - Fetch attempt failed with DNS resolution error in the sandbox; no claims in this note rely on the page contents.
- #fetch:https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
  - Fetch attempt failed with DNS resolution error in the sandbox; no claims in this note rely on the page contents.
- #fetch:https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips
  - Fetch attempt failed with DNS resolution error in the sandbox; no claims in this note rely on the page contents.
- #fetch:https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
  - Fetch attempt failed with DNS resolution error in the sandbox; no claims in this note rely on the page contents.
- #fetch:https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken
  - Fetch attempt failed with DNS resolution error in the sandbox; no claims in this note rely on the page contents.
- #fetch:https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/prompt-engineering
  - Fetch attempt failed with DNS resolution error in the sandbox; no claims in this note rely on the page contents.

### Project Conventions

- Standards referenced: `.github/copilot-instructions.md` for repo-wide conventions, `.github/instructions/*.instructions.md` for ask/edit/agent mode guidance, `README.md` for supported Copilot artifacts, `package.json` scripts (`lint`, `test`) for normal validation commands.
- Instructions followed: research-only update limited to `/home/runner/work/copilot-enabler/copilot-enabler/.copilot-tracking/research/`, absolute paths, evidence-backed findings only, and one recommended approach with alternatives removed.

## Key Discoveries

### Project Structure

This repository is already organized around Copilot-adoption surfaces that commonly create token overhead: repo-wide instructions, mode-specific instructions, skills, hooks, and MCP tools. The README explicitly says those artifacts are scanned locally (`README.md:75-84`). The feature definitions go further: custom instructions are described as context included in every interaction (`src/core/features/customization/custom-instructions.ts:14-35`), agent skills may auto-load based on relevance (`src/core/features/customization/custom-agent-skills.ts:18-32`), and MCP servers enlarge the available tool surface (`src/core/features/customization/custom-mcp-servers.ts:18-34`). That means token-waste detection should not focus only on prompts; it should inspect the full context assembly pipeline.

### Implementation Patterns

The repo's own guidance demonstrates the main waste patterns from the issue:

1. Near-duplicate instructions already exist across guidance files.
   - `Run npm run lint and npm test` appears in four places with only minor wording differences.
   - `.vscodeignore` packaging guidance appears in multiple files.
   - fail-fast and `showErrorMessage` guidance is repeated with small wording changes.
   These are not necessarily wrong, but they show why exact-match dedupe is not enough; near-duplicate detection is required.

2. Broad, always-on instructions are mixed with mode-specific instructions.
   - `.github/copilot-instructions.md` contains persistent TypeScript, architecture, testing, and packaging guidance (`.github/copilot-instructions.md:11-41`).
   - ask/edit/agent mode files repeat overlapping constraints with slightly different phrasing (`.github/instructions/*.instructions.md`).
   For a research or documentation task, much of the TypeScript/webview packaging guidance is likely low-yield context.

3. The repo already contains an executable pattern for usage auditing.
   - `.github/hooks/prerun.json` shows a `PreToolUse` hook structure and a `logTools` list (`.github/hooks/prerun.json:1-14`).
   This provides a concrete anchor for behavioral or executable detection of low-utility tools and instructions.

4. Generic role/persona boilerplate is a measurable source of overhead.
   - In the local experiment, adding `You are a staff software engineer. Be concise.` increased prompt length materially, and repeating it created a duplicate-word ratio of `0.308` without adding new task-specific information.
   - The implication is not that persona or brevity instructions are always useless. The implication is that they should survive only if they change measurable behavior for a given environment or failure mode.

5. Low topical relevance is detectable even with simple heuristics.
   - The lexical relevance experiment showed a broad style/persona block (`0.024`) was nearly as unrelated to the token-waste task as plainly unrelated codebase context (`0.025`).
   - This supports a practical screening rule: if an instruction block has very low task overlap and low historical impact, scope it, summarize it, or make it on-demand.

6. Additional token-waste classes beyond the original issue list are identifiable.
   - Near-duplicate wording instead of exact duplication.
   - Over-specified examples that teach the same pattern repeatedly.
   - Large static metadata blocks (YAML/JSON/tool schemas) that are injected even when the task never invokes them.
   - Stale retrieved context that was useful earlier in the conversation but is not referenced again after the topic shifts.
   - Low-traceability instructions: context whose key nouns, verbs, or required outputs never show up in the plan, tool calls, or final answer.
   - Serialization overhead: long formatting rules, bullet scaffolds, and examples that consume budget but do not change model behavior.

### Complete Examples

```python
from __future__ import annotations

import re
from dataclasses import dataclass

WORD_RE = re.compile(r"[a-z0-9]+")


def words(text: str) -> list[str]:
    return WORD_RE.findall(text.lower())


def jaccard(a: str, b: str) -> float:
    sa, sb = set(words(a)), set(words(b))
    return len(sa & sb) / len(sa | sb) if sa or sb else 0.0


@dataclass(frozen=True)
class ContextItem:
    source: str
    text: str
    always_on: bool = False
    historical_use_rate: float = 0.0  # fraction of sessions where the item changed outputs


def duplicate_ratio(text: str) -> float:
    tokens = words(text)
    if not tokens:
        return 0.0
    unique = len(set(tokens))
    return 1.0 - (unique / len(tokens))


def score_item(task: str, item: ContextItem) -> dict[str, float | bool | str]:
    relevance = jaccard(task, item.text)
    duplication = duplicate_ratio(item.text)
    likely_waste = (
        item.always_on
        and relevance < 0.05
        and item.historical_use_rate < 0.1
    ) or duplication > 0.25
    return {
        "source": item.source,
        "relevance": round(relevance, 3),
        "duplication": round(duplication, 3),
        "always_on": item.always_on,
        "historical_use_rate": item.historical_use_rate,
        "likely_waste": likely_waste,
    }


def traceability_gap(item: str, output: str) -> float:
    item_terms = {w for w in words(item) if len(w) > 4}
    output_terms = set(words(output))
    if not item_terms:
        return 0.0
    return 1.0 - (len(item_terms & output_terms) / len(item_terms))


if __name__ == "__main__":
    task = "Research token waste and optimize instructions for Copilot context assembly."
    items = [
        ContextItem("repo-wide persona", "You are a staff software engineer. Be concise.", True, 0.02),
        ContextItem("research-task instructions", "Document verified findings and write a research note under .copilot-tracking/research.", True, 0.8),
        ContextItem("typescript style block", "Use semicolons. Keep webview HTML inline. Avoid any.", True, 0.05),
    ]
    for item in items:
        print(score_item(task, item))
```

Source basis for this example: the script mirrors the exact kinds of overlap and duplication checks that were run locally against the repo's instruction files and synthetic prompt fragments during this research session.

### API and Schema Documentation

Verified repo-local behavior relevant to token waste:

- Custom instructions
  - File: `.github/copilot-instructions.md`
  - Effect in repo docs: treated as project-specific guidance and scanned as a workspace artifact (`README.md:75-84`).
  - Effect in feature definition: intended to be automatically included in every interaction (`src/core/features/customization/custom-instructions.ts:14-35`).

- Mode-specific instructions
  - Files: `.github/instructions/*.instructions.md`
  - Effect: add ask/edit/agent variants on top of repo-wide instructions, creating a layered instruction stack (`.github/instructions/ask.instructions.md:3-27`, `.github/instructions/edit.instructions.md:3-23`, `.github/instructions/agent.instructions.md:3-23`).

- Agent skills
  - Files: `.github/skills/<skill>/SKILL.md`
  - Effect in feature definition: may be invoked manually or loaded automatically based on relevance (`src/core/features/customization/custom-agent-skills.ts:18-32`).

- MCP servers
  - File: `.vscode/mcp.json`
  - Effect in feature definition: defines external tool connections and optional inputs; supports `stdio`, `http`, and `sse` transports (`src/core/features/customization/custom-mcp-servers.ts:18-34`).

- Hooks
  - Files: `.github/hooks/*.json`
  - Verified shape in repo: `hooks.PreToolUse[]` with `type`, `command`, and optional `env`, plus a `logTools` list in `.github/hooks/prerun.json:1-14`.

### Configuration Examples

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "./github/hooks/scripts/log-tool-use.sh",
        "env": {
          "AUDIT_LOG": ".github/hooks/audit.log"
        }
      }
    ],
    "logTools": ["npm run lint", "npm test"]
  }
}
```

This exact configuration exists in `/home/runner/work/copilot-enabler/copilot-enabler/.github/hooks/prerun.json` and demonstrates that executable usage auditing is already a familiar pattern in this repository.

### Technical Requirements

A useful token-waste detector should combine four measurable axes instead of relying on intuition alone:

1. Uniqueness
   - Detect exact duplicates and near-duplicates.
   - Use line hashing plus fuzzy similarity on normalized text.
   - Merge or centralize anything repeated across system, repo, mode, skill, or memory layers.

2. Relevance
   - Score each injected item against the current task, file set, or conversation window.
   - If `applyTo` exists, verify it actually narrows the contexts where the instruction fires.
   - If no scoping exists, measure whether the item is always-on despite low task overlap.

3. Utilization
   - For tools, skills, or MCP descriptions, record whether they were ever selected or referenced.
   - For retrieved files or memories, record whether the assistant cited or used them in the resulting plan, tool calls, or answer.
   - Default rarely-used items to opt-in instead of always-loaded.

4. Traceability
   - Extract key nouns and verbs from each instruction block.
   - Check whether those terms appear later in the plan, tool calls, generated files, or final answer.
   - A high traceability gap is a strong signal that the context item was waste.

Behavioral and executable techniques for identifying and fixing waste:

- Exact / near-duplicate audit
  - Identify: run a nightly comparison across system, custom, mode, skill, memory, and tool-description layers.
  - Solve: keep one canonical version and replace duplicates with references or shorter summaries.

- Scope audit for `applyTo` and tool descriptions
  - Identify: compare the current task's nouns, file paths, and language against the instruction's trigger conditions.
  - Solve: narrow `applyTo`, split mixed instructions by language or task type, and shorten skill/MCP descriptions to the minimum distinguishing text.

- Low-yield always-on context audit
  - Identify: if an item is loaded every session but rarely affects output or tool selection, classify it as default-off.
  - Solve: move it behind mode selection, explicit invocation, or retrieval triggered by relevant files.

- Topic drift detector
  - Identify: when similarity between the last few turns and the current turn drops below threshold and the referenced code area changes, treat prior context as stale.
  - Solve: summarize the old thread, start a fresh session, or rebuild context from only the new task's files.

- Persona and style audit
  - Identify: measure prompts with and without role/style boilerplate such as `You are a staff software engineer` or `be concise`.
  - Solve: keep persona or brevity rules only when they measurably reduce known failure modes. Otherwise move them to one global default or remove them entirely.

- Example bloat audit
  - Identify: count examples inside instructions and check whether the assistant later uses them.
  - Solve: keep one representative example per behavior, move the rest to linked docs or on-demand help.

- Large schema / metadata audit
  - Identify: record token share consumed by tool schemas, long YAML frontmatter, or repeated command menus.
  - Solve: summarize capabilities first, lazy-load full schemas only when the tool or skill is chosen.

## Recommended Approach

Adopt a single "context budget audit" pipeline that scores every injected context item on uniqueness, relevance, utilization, and traceability before it becomes always-on.

Why this is the best fit for this repo:

- It matches the repo surface area. The extension already scans instructions, skills, hooks, and MCP configuration (`README.md:75-84`), so a context-budget model can cover the exact artifacts the product exposes.
- It handles both behavioral and executable waste. Duplicate guidance, broad skill descriptions, unused tools, and topic drift all become measurable instead of subjective.
- It avoids a brittle "delete boilerplate everywhere" policy. Some persistent instructions are genuinely useful; the audit keeps only items that survive measurement.
- It aligns with the repo's existing hook mindset. `.github/hooks/prerun.json` already demonstrates usage logging, which can evolve into token-usage and tool-usage telemetry.

Recommended decision rules:

- Remove or centralize instruction text when exact or fuzzy duplication crosses a chosen threshold.
- Scope instructions whenever task overlap stays low across a meaningful sample of sessions.
- Default skills, memories, and MCP tool descriptions to on-demand loading when historical use rate is low.
- Trigger a conversation reset or context rebuild when topic drift is detected.
- Treat generic persona/style boilerplate as guilty until proven useful by measurable output improvements.

## Implementation Guidance

- **Objectives**: Build a repeatable way to detect token waste across custom instructions, mode instructions, skills, MCP tools, hooks, retrieved files, and conversation carryover; reduce waste without removing genuinely helpful task context.
- **Key Tasks**:
  - Inventory every source of injected context in a session.
  - Compute exact-duplicate, near-duplicate, relevance, utilization, and traceability scores.
  - Add logging for tool and skill invocation so always-loaded but never-used surfaces are visible.
  - Add drift checks so stale context can be summarized or dropped when the user changes topic.
  - Review boilerplate persona/style instructions with A/B comparisons instead of assuming they help.
- **Dependencies**:
  - Access to actual assembled prompts or a context manifest per turn.
  - A tokenizer or token-count approximation for the target model family.
  - Session logs or hook telemetry showing which tools, skills, files, and instructions were actually exercised.
  - Optional external-doc follow-up in an unrestricted environment to validate these local findings against vendor guidance.
- **Success Criteria**:
  - Duplicate and near-duplicate instruction blocks are measurably reduced.
  - Always-on context shrinks while task success and output quality remain stable or improve.
  - Unused tools, skills, and MCP descriptions are no longer loaded by default.
  - Topic changes trigger context refresh instead of dragging stale history forward.
  - Persona/style boilerplate is retained only where it produces measurable benefit.
