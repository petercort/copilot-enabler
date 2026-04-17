# Promptimizer — Prompt Context Analysis

## What it does

Promptimizer ingests your agent prompt logs (Copilot Chat traces, Anthropic
SDK JSONL dumps, or mitmproxy/Charles HAR captures) and breaks every request
into labeled blocks: system prompts, custom instructions, skills, MCP tool
schemas, messages, attachments, and tool results. It tokenizes each block,
visualizes where your context window is actually spent, and tracks which
blocks stay stable across turns. On top of that view, it runs a rule engine
that recommends concrete prompt-caching breakpoints (rules R-C1 through R-C5)
and estimates the dollar savings per 100 turns for each one.

All analysis runs locally in the extension host. Nothing is uploaded.

## Commands

| Command ID | What it does |
|---|---|
| `copilotEnabler.promptimizer.open` | Open the Promptimizer dashboard webview. |
| `copilotEnabler.promptimizer.ingestFile` | Pick a JSONL or HAR file to analyze. |
| `copilotEnabler.promptimizer.ingestCopilotChat` | Scan local Copilot Chat log directories. |
| `copilotEnabler.promptimizer.refresh` | Re-run analysis against the currently loaded sessions. |
| `copilotEnabler.promptimizer.openFinding` | Focus a finding in the dashboard (invoked from the tree view). |

## Ingest sources

Promptimizer does not intercept live traffic. You point it at one of three
log formats and it reconstructs the prompts that were sent.

### Copilot Chat logs (auto-discovered)

Run `copilotEnabler.promptimizer.ingestCopilotChat` and the extension walks
your local VS Code log tree and picks up any Copilot Chat log files:

- macOS: `~/Library/Application Support/Code/logs/`
- Linux: `~/.config/Code/logs/`
- Windows: `%APPDATA%\Code\logs\`

Only lines that look like request payloads (have a `messages`, `system`, or
`tools` field) are parsed. Unparseable lines are skipped silently.

### JSONL (Anthropic SDK debug dumps)

One JSON object per line, where each object is either a raw Anthropic
`messages.create` request body or a wrapper of the form:

```json
{"session_id": "my-session", "turn": 0, "request": { "model": "...", "system": "...", "messages": [...], "tools": [...] }}
```

Lines without an explicit `session_id` are grouped into a single synthetic
session named after the file.

To capture JSONL from an app using the Anthropic SDK, enable SDK debug
logging — see the Anthropic SDK docs
(<https://docs.anthropic.com/en/api/client-sdks>) for the environment
variable your language's SDK uses (for example, `ANTHROPIC_LOG=debug` for
the TypeScript and Python SDKs). Redirect the debug output to a file and
feed that file to `copilotEnabler.promptimizer.ingestFile`.

### HAR (mitmproxy / Charles captures)

Any `.har` file that contains `POST` requests to `api.anthropic.com` or an
OpenAI-compatible `/chat/completions` endpoint. Each matching request
becomes one turn; all requests in the HAR share a single session id derived
from the filename.

## What you'll see

The dashboard is a single scrolling webview with the following panels:

- **Summary cards** — total input tokens, total turns, estimated fresh-input
  cost for the current session, and potential savings if all findings are
  applied. Answers: "Is this session expensive, and is there headroom?"
- **Stacked bar by turn** — one stacked bar per turn, colored by block
  category. Answers: "How does the context window grow over the session,
  and which category is driving growth?"
- **Category treemap** — area proportional to token count per category
  (aggregate or for a selected turn). Answers: "Right now, which category
  is eating my window?"
- **Per-MCP tool list** — every MCP and built-in tool ranked by tokens,
  with the server they came from. Answers: "Which tool descriptions are
  the heaviest, and do I need all of them?"
- **Diff heatmap** — a grid of block-stability across turns. Answers:
  "Which blocks are stable enough to cache, and which ones are churning?"
- **Findings table** — every R-C* finding with its rule, evidence, risk,
  estimated `$/100 turns`, and the raw patch JSON. Answers: "What exactly
  should I change, and what will it save?"

A complementary tree view lists `Sessions -> Turns -> Findings`, plus a
"Top Findings" node that aggregates the best-ranked recommendations across
all loaded sessions.

## Caching rules reference

All v1 recommendations are caching rules. They reference the block IDs the
tokenizer assigned during ingest.

| Rule | Trigger | Action |
|---|---|---|
| **R-C1** | `system` + tool blocks are stable across at least 3 consecutive turns and total more than 1024 tokens, and no `cache_control` is set yet. | Insert a `cache_control` breakpoint on the last `system` block with a 5-minute TTL. |
| **R-C2** | The prefix cache is reused across a session with idle gaps longer than 5 minutes (or a long session of 10+ turns). | Change the existing breakpoint's TTL from `5m` to `1h` to avoid paying repeat write penalties. |
| **R-C3** | A stable history or summary block sits after the prefix breakpoint and exceeds 1024 tokens. | Add a second `cache_control` breakpoint after the summary so it caches independently of the live tail. |
| **R-C4** | A churning block (e.g. a timestamp, ephemeral skill) is interleaved between two stable blocks. | Move the churning block past the breakpoint so it does not invalidate the cached prefix. |
| **R-C5** | The conversation has grown more than 20 blocks past the last breakpoint, risking silent cache misses on Anthropic's 20-block lookback window. | Insert a fresh `cache_control` breakpoint before the window expires. |

Findings also carry a `quality_risk` label (`none`, `low`, `medium`, or
`high`). R-C1 and R-C2 are `none`; R-C3 and R-C4 are `low`; R-C5 is
`medium`. Rankings in the tree's "Top Findings" node favor high savings
and low risk.

## Cost model

Pricing is taken from Anthropic's published rates. Base fresh-input rates
per million tokens:

| Model | Fresh input (USD/MTok) |
|---|---|
| `claude-sonnet-4.6` | 3.00 |
| `claude-sonnet-4.5` | 3.00 |
| `claude-opus-4.7` | 15.00 |
| `claude-opus-4.6` | 15.00 |

Cache-tier multipliers are applied on top of the fresh rate: `write5m` is
1.25x, `write1h` is 2.0x, and `read` is 0.1x.

### Worked example (Sonnet 4.6)

```
fresh:    3.00 $/MTok input
5m write: 3.75 $/MTok   (1.25x)
1h write: 6.00 $/MTok   (2.00x)
read:     0.30 $/MTok   (0.10x)
```

A 20,000-token system+tools prefix sent 100 times in an hour:

- Uncached: `20k * 100 * $3/MTok` = **$6.00**
- 5m cached (one write, 99 reads):
  `20k * $3.75/MTok + 20k * 99 * $0.30/MTok` = `$0.075 + $0.594` = **$0.67**

About 9x cheaper. This is why every finding carries a
`usd_per_100_turns` estimate — the caching rule alone usually dominates
every other optimization.

## Configuration

Both settings live under `copilotEnabler.promptimizer` in your VS Code
settings.

| Setting | Values | Default | Purpose |
|---|---|---|---|
| `copilotEnabler.promptimizer.model` | `claude-sonnet-4.6`, `claude-sonnet-4.5`, `claude-opus-4.7`, `claude-opus-4.6` | `claude-sonnet-4.6` | Which published Anthropic price list to use for all cost estimates. |
| `copilotEnabler.promptimizer.tokenizer` | `heuristic` | `heuristic` | Tokenization strategy. v1 only supports the heuristic tokenizer (see Limitations). |

## Limitations (v1)

- **Heuristic tokenizer only.** Token counts are computed as
  `ceil(characters / 4)` per block. This is deterministic and requires no
  network access, but it is an approximation — real tokenizer output
  typically differs by 5-15%. Treat the numbers as directional.
- **No auto-apply.** Findings carry a `patch` payload describing the
  suggested change, but Promptimizer never rewrites your prompts for you.
  You copy the patch and apply it in your own code.
- **No algorithmic compression.** Rules like tool-description rewrites,
  LLMLingua-style pruning, or retrieval-over-repetition detection are not
  included in v1. Only caching rules (R-C1..R-C5) ship.
- **No session-hygiene rules.** Rules around `/clear`, summarization, and
  agent handoff (R-S* in the research doc) are planned but not in v1.

## FAQ

**Why are my numbers approximate?**

The v1 tokenizer uses a fixed `chars / 4` heuristic. This is fast,
deterministic, and entirely offline, but it is not the exact tokenizer any
model uses. Expect single-digit-percent error on totals and slightly
larger error on very short or highly structured blocks. A pluggable
interface for real tokenizers is already in place for a future release.

**How do I capture a log?**

The simplest path is `copilotEnabler.promptimizer.ingestCopilotChat`,
which reads existing VS Code Copilot Chat logs in place. For apps using
the Anthropic SDK directly, enable SDK debug logging
(`ANTHROPIC_LOG=debug`) and pipe the output to a `.jsonl` file. For any
other client, run the request through mitmproxy or Charles and export the
capture as `.har`.

**Is my data sent anywhere?**

No. All ingestion, tokenization, classification, and recommendation runs
locally inside the VS Code extension host. Promptimizer makes no network
calls and does not require an API key.

**How do I apply a recommendation?**

Open the findings table in the dashboard, find the rule you want to apply,
and copy the `patch` JSON. It describes the change in the form
`{"type": "insert_cache_control", "after_block": "<block-id>", "ttl": "5m"}`
(or similar). Apply that change to the place in your code that constructs
the request body — for example, add `cache_control: {"type": "ephemeral",
"ttl": "5m"}` to the block identified by `after_block`. Re-ingest a fresh
log afterward to confirm the finding no longer fires.
