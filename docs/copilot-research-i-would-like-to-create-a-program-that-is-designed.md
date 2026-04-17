# Research: i would like to create a program that is designed 

*Generated: 4/17/2026, 11:57:18 AM*

---

# Promptimizer — Research Report

A program that visualizes prompt context and recommends token‑use optimizations while preserving output quality.

## Executive Summary

This report scopes a tool ("Promptimizer") that (1) **ingests** raw prompt payloads from agent debug sessions, (2) **classifies and measures** every contributor to the context window — system prompts, agent / sub‑agent instructions, skills, custom instructions, MCP tool schemas, conversation history, attachments — and (3) **recommends token‑saving optimizations** ranked by expected savings vs. quality risk. The recommendation engine combines four bodies of work: (a) Anthropic's prompt‑caching primitives (5‑minute and 1‑hour TTL, prefix lookback, breakpoint slots)[^1], (b) the user‑authored `optimizations.md` operating model (scoping `applyTo`, on‑demand skills, MCP profile pruning, session hygiene)[^2], (c) academic prompt‑compression research (LLMLingua / LLMLingua‑2 / LongLLMLingua, Selective Context)[^3][^4][^5][^6], and (d) recent agent‑context findings — instruction conflicts grow with hierarchy depth (ManyIH)[^7] and coding agents systematically over‑recall context they never use (ContextBench)[^8]. The two effects argue for **fewer, sharper instructions and tighter retrieval** as a quality *and* cost lever — i.e., compression generally aligns with quality, not against it, up to the point where critical signal is removed.

The remainder of this document specifies the data model, analysis pipeline, visualizations, and a prioritized catalog of optimization rules the program should produce.

---

## 1. Problem Framing

For a single agent turn, the model's input is a structured concatenation, billed per token:

```
[ tools ]  →  [ system + custom_instructions + skills ]  →  [ messages (history + attachments + tool_results) ]
```

The order matters because Anthropic's cache prefix is built in exactly this sequence: `tools`, then `system`, then `messages`, up to the block carrying `cache_control`[^1]. Anything that mutates an *earlier* block invalidates the cached prefix downstream.

Three independent cost dimensions exist:

| Dimension | Lever | Tooling target |
|---|---|---|
| **Volume** (tokens in window) | Compress / prune / scope | Sections 4, 6, 7 |
| **Reuse** (cached vs. fresh) | Stable prefix + cache breakpoints | Section 5 |
| **Variance** (turn‑over‑turn churn) | Session hygiene, summarization | Section 8 |

A pure "shrink the prompt" view misses (2) and (3): a 10k‑token system prompt that is fully cached at $0.30/MTok read cost (Sonnet) is cheaper than a 3k‑token system prompt that gets rewritten every request and billed at $3/MTok input[^1].

---

## 2. Architecture Overview

```
┌────────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│  1. Ingest         │───▶│  2. Classify     │───▶│  3. Tokenize       │
│  (debug logs,      │    │  (label each     │    │  (tiktoken /       │
│   .har, JSONL,     │    │   block: system, │    │   anthropic count  │
│   anthropic-       │    │   tool, skill,   │    │   tokens API)      │
│   beta count_      │    │   mcp, msg, …)   │    │                    │
│   tokens)          │    └──────────────────┘    └─────────┬──────────┘
└────────────────────┘                                      │
                                                            ▼
┌────────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│  6. Recommend      │◀───│  5. Diff & cache │◀───│  4. Visualize      │
│  (rule engine,     │    │  analysis (which │    │  (treemap, sankey, │
│   est. $ savings,  │    │   blocks change  │    │   stacked bar by   │
│   risk score)      │    │   per turn)      │    │   category & turn) │
└─────────┬──────────┘    └──────────────────┘    └────────────────────┘
          ▼
┌────────────────────┐
│  7. Apply / export │
│  (rewrites, MCP    │
│   profile, applyTo │
│   scopes)          │
└────────────────────┘
```

---

## 3. Step 1 — Ingest: Where the Prompts Live

The program needs raw, *post‑assembly* payloads (what actually went on the wire), not the source files that produced them. Useful sources:

| Source | How to capture | Notes |
|---|---|---|
| **Anthropic SDK** | Set `ANTHROPIC_LOG=debug` or wrap the client to dump `messages.create` request bodies to JSONL. | Includes `system`, `tools`, `messages`, `cache_control` markers — perfect for analysis. |
| **VS Code Copilot Chat** | `Developer: Set Log Level → Trace`, then **Output → GitHub Copilot Chat**; or launch `code --log trace` and read the per‑extension log directory[^9]. | Logs include the assembled prompt segments per turn; copy from the Output panel or scrape the log files. |
| **Copilot CLI debug** | Run with `COPILOT_LOG_LEVEL=debug` (or the supported `--debug` flag for the version) and pipe stderr to a file. | Same payload shape as the Chat extension. |
| **MCP traffic** | Capture the JSON‑RPC `tools/list` response — that is exactly what gets serialized into the `tools` array sent to the model. | Needed to attribute "MCP overhead" precisely. |
| **HTTP middlebox (`mitmproxy`/Charles)** | Intercept HTTPS to `api.anthropic.com` / `api.openai.com`. | Vendor‑agnostic fallback when SDK logging is not available. |

Recommended canonical schema for an ingested turn:

```jsonc
{
  "session_id": "…", "turn": 7, "model": "claude-opus-4.7",
  "blocks": [
    { "id": "sys-base",   "category": "system",             "text": "...", "stable": true,  "cache_control": {"type":"ephemeral","ttl":"1h"} },
    { "id": "ci-md",      "category": "custom_instruction", "applyTo": "**/*.md", "text": "...", "stable": true },
    { "id": "skill-pdf",  "category": "skill",              "name": "pdf",  "text": "...", "stable": false },
    { "id": "tool-gh",    "category": "mcp_tool",           "server": "github", "name": "search_issues", "schema": { … } },
    { "id": "msg-u-7",    "category": "user_message",       "text": "..." },
    { "id": "msg-tool-7", "category": "tool_result",        "text": "..." }
  ]
}
```

Stability (`stable: true|false`) is computed in step 5 by hashing each block across turns — it drives both cache recommendations *and* the variance score in step 6.

---

## 4. Step 2 — Analysis & Visualization

### 4.1 Tokenization

For Anthropic models, prefer the official **`messages.count_tokens`** endpoint: it counts exactly what the billing pipeline sees, including tool schemas and `cache_control` overhead. For OpenAI/GPT family, use `tiktoken` with the encoding matching the target model[^10]. Always tokenize **per block** (not the concatenated string) so attribution is accurate.

### 4.2 Categories the dashboard must surface

1. `system` – base orchestration prompt
2. `custom_instructions` – user/org rules (further split by `applyTo` scope)
3. `skill` – on‑demand instruction packs
4. `agent` / `sub_agent` – delegated agent system prompts
5. `mcp_tool` – per‑tool JSON schema (broken down per server)
6. `built_in_tool` – first‑party tool schemas
7. `messages.user`, `messages.assistant`, `messages.tool_result`
8. `attachment` – pasted files, screenshots (image tokens)
9. `cache_control_overhead` – the metadata itself is negligible but worth showing for transparency

### 4.3 Charts to ship in v1

| Visualization | What it answers | Notes |
|---|---|---|
| **Stacked bar by turn** (x = turn index, y = tokens, color = category) | "Where did context grow?" | Surfaces history bloat and tool‑result dumps. |
| **Treemap of categories** (single turn or aggregated) | "What dominates a typical request?" | Makes oversized MCP catalogs and skill packs immediately visible. |
| **Sankey: stable → cached vs. variable → billed input** | "How much could caching save?" | Drives the cache recommendation in §5. |
| **Per‑MCP‑tool ranked list** | "Which tool descriptions are paying rent?" | Sort by tokens × invocations‑per‑hundred‑turns to expose dead weight. |
| **Diff heatmap turn‑over‑turn** | "Which blocks churn and break the cache?" | Any block that flips on turn N invalidates everything after it in the prefix order[^1]. |
| **Cumulative cost panel** | "$/session under current vs. recommended config" | Computed from §5 pricing table. |

---

## 5. Step 3 — Caching as the Highest‑ROI Optimization

Anthropic's prompt caching is the single biggest *cost* lever (less so a token‑count lever — cached tokens still occupy the context window, but they are billed at **0.10×** input price on read)[^1]. Key mechanics the analyzer must encode:

- **Prefix order is fixed:** `tools` → `system` → `messages`. The cache key is the *cumulative* hash up to a `cache_control` breakpoint[^1].
- **Up to 4 explicit breakpoint slots per request** (automatic caching consumes one of them)[^1].
- **20‑block lookback window:** when the breakpoint hash misses, the system walks backward up to 20 blocks looking for *any* prior write to reuse. Beyond 20 blocks the entry is unreachable[^1].
- **TTLs:** 5 minutes (default, 1.25× write multiplier) or 1 hour (2× write multiplier). Reads are 0.1× input price for both[^1].
- **Cache writes only happen at the breakpoint** — there is no implicit caching of earlier positions[^1].

### 5.1 Recommendations the engine should emit

| Rule | Trigger | Action | Expected impact |
|---|---|---|---|
| **R‑C1: Cache the system+tools prefix** | `tools` + `system` are stable across ≥3 consecutive turns and total >1024 tokens (Sonnet/Opus minimum). | Insert `cache_control` on the last `system` block. | ~90% discount on those tokens after first hit[^1]. |
| **R‑C2: Promote to 1‑hour TTL** | Same prefix is reused across long sessions (>5 min idle gaps observed). | Use `ttl: "1h"`. | Avoids paying the 1.25× write penalty repeatedly. |
| **R‑C3: Second breakpoint after stable history** | Long session with a stable summary block followed by churning recent turns. | Add a second `cache_control` after the summary. | Caches the heavy historical chunk separately from the live tail. |
| **R‑C4: Reorder to maximize prefix stability** | A churning block (e.g., timestamp, ephemeral skill) is interleaved between two stable blocks. | Move the churning block *after* the breakpoint. | Prevents prefix invalidation. |
| **R‑C5: Watch the 20‑block window** | Conversation grows past 20 added blocks between breakpoints. | Add a second breakpoint inside the window before the cache becomes unreachable. | Avoids silent cache misses[^1]. |

### 5.2 Cost model (Sonnet 4.6 example)[^1]

```
fresh:    3.00 $/MTok input
5m write: 3.75 $/MTok      (1.25×)
1h write: 6.00 $/MTok      (2.00×)
read:     0.30 $/MTok      (0.10×)
```

So a 20k‑token system+tools prefix sent 100 times in an hour costs:

- **Uncached:** 20k × 100 × $3/MTok = **$6.00**
- **5m cached (one write, 99 reads):** 20k × $3.75/MTok + 20k × 99 × $0.30/MTok = $0.075 + $0.594 = **$0.67** (≈ 9× cheaper)

This single rule typically dwarfs every other optimization combined; the program should always estimate it first.

---

## 6. Step 4 — Compression Strategies (volume reduction)

When tokens cannot simply be cached (they are variable, e.g., per‑task context), reduce them.

### 6.1 Mechanical / authoring rewrites (deterministic, low risk)

- **Tool‑description squeeze.** MCP and built‑in tool schemas frequently contain marketing prose. Rewrite to `Name: purpose. Input: …. Output: ….`; remove duplicated boilerplate ("This tool can be used to…"). Typical savings 50–70% on the `tools` block.
- **Schema dedup.** When two MCP servers expose overlapping verbs, register only one in the active profile (matches `optimizations.md` guidance to "keep tool catalogs small and purpose‑built")[^2].
- **`applyTo` scoping for custom instructions.** Replace global rules with file/path‑scoped rules so they only enter the window when relevant[^2].
- **On‑demand skills.** Move long, infrequent guidance into skills loaded by trigger rather than always‑on instructions[^2].
- **Strip examples to one canonical example.** Few‑shot examples are high‑token; one well‑chosen example usually dominates many mediocre ones.
- **Markdown → telegraphic.** In policy text, drop articles ("the", "a"), collapse list prefaces, and prefer imperative bullets.

### 6.2 Algorithmic compression (probabilistic, medium risk)

- **LLMLingua / LLMLingua‑2.** Token‑level pruning using a small LM to score informativeness; reported 2–20× compression with <1pt drop on QA at moderate ratios. LLMLingua‑2 is task‑agnostic and faster (classification head over a BERT‑sized model)[^3][^4].
- **LongLLMLingua.** Adds question‑aware coarse‑to‑fine selection for long documents; tuned for RAG/long‑context QA[^5].
- **Selective Context.** Drops low self‑information tokens/sentences using a base LM's surprisal; lighter weight than LLMLingua[^6].

The engine should not silently apply these to system prompts; instead it should offer an **"experimental compression"** action that produces a diff and an estimated quality risk badge, leaving acceptance to the user.

### 6.3 Retrieval over repetition

`optimizations.md` calls this out explicitly: **link or reference canonical sources** (file paths, URLs) instead of pasting blobs that recur turn‑over‑turn[^2]. The analyzer should detect duplicated substrings (≥200 chars, appearing in ≥2 turns) and recommend replacing them with a reference plus an on‑demand fetch.

### 6.4 What *not* to compress

ContextBench shows LLM coding agents already err toward **high recall, low precision** when retrieving context — they pull in more than they use[^8]. Compressing the *noise* is safe and even improves quality. Compressing dense, gold‑standard context (precise file regions an agent actually reads) hurts. The program should weight compression aggressiveness by a "block utilization" estimate (e.g., did any later assistant turn quote/edit content from this block?).

---

## 7. Step 5 — Session & Lifecycle Hygiene

These rules track variance over time, complementing the static analysis above. They directly mirror `optimizations.md` §"Manage context window lifecycle"[^2]:

| Rule | Detector | Action |
|---|---|---|
| **R‑S1: Summarize old turns** | Conversation > N tokens AND oldest 50% has no recent reference. | Replace history tail with a single summary block; preserve last K turns verbatim. |
| **R‑S2: Prune stale tool results** | Large tool result (>2k tokens) not cited by any subsequent assistant turn. | Replace body with `[truncated — see <ref>]`. |
| **R‑S3: Restart on quality regression** | Retry/re‑prompt rate over the last 5 turns exceeds baseline by 2σ. | Suggest a fresh thread seeded with the running summary. |
| **R‑S4: Profile switch** | Detected task class changes (e.g., docs → debugging). | Recommend swapping the MCP/skill profile rather than additively loading both. |
| **R‑S5: Instruction‑hierarchy hygiene** | Conflicting instructions detected across `system`, `custom_instructions`, and `skill` blocks. | Surface conflicts; ManyIH shows even frontier models drop to ~40% accuracy as conflicts scale[^7]. |

---

## 8. Recommendation Engine — Output Schema

For each finding the engine should emit:

```jsonc
{
  "rule": "R-C1",
  "category": "caching",
  "evidence": { "blocks": ["sys-base","tool-gh","tool-fs"], "stable_turns": 14, "tokens": 18420 },
  "estimated_savings": { "tokens_per_turn": 0,           // caching saves $, not tokens
                         "usd_per_100_turns": 5.34,
                         "input_token_share_after": 0.62 },
  "quality_risk": "none|low|medium|high",
  "auto_applicable": true,
  "patch": { "type": "insert_cache_control", "after_block": "tool-fs", "ttl": "1h" }
}
```

Sort findings by `usd_per_100_turns` × `1 / quality_risk_weight` to give a one‑click "apply top 5" affordance.

---

## 9. Recommended Build Order

1. **Ingest + tokenize + classify** (one file, JSONL in / JSON out). Validate against an Anthropic SDK debug dump.
2. **Static dashboard** (treemap + stacked bar). This alone delivers most of the user‑facing value.
3. **Diff/cache analyzer** and Anthropic cost model (rules R‑C1…R‑C5). Highest ROI.
4. **Authoring rewrites** for tool descriptions and `applyTo` scopes (rules from §6.1 + §7).
5. **Optional algorithmic compression** behind an opt‑in flag (LLMLingua‑2 wrapper).
6. **Continuous mode** — watch a log directory, emit Slack/CLI notifications when the cache hit ratio or duplicate‑content score regresses.

---

## 10. Confidence Assessment

- **High confidence:** Anthropic prompt‑caching mechanics, pricing, breakpoint slot count, lookback window — all from the official docs[^1]. The `optimizations.md` operating model is taken verbatim from the user's file[^2]. Tokenization mechanics for `tiktoken` and the per‑section counting pattern are well established[^10].
- **Medium confidence:** Quantitative savings figures for compression (LLMLingua family) — taken from paper abstracts/search summaries[^3][^4][^5][^6]; real‑world numbers vary by task and model. The 50–70% MCP description squeeze is an empirical heuristic, not a measured benchmark.
- **Inferred / opinionated:** The recommendation ordering, schema shape, and "block utilization" weighting are design recommendations, not citations. The Copilot CLI `COPILOT_LOG_LEVEL` flag exists in some builds; verify against the running version before relying on it (the VS Code Output‑panel route is the safer fallback)[^9].
- **Note on user‑provided arxiv links:** The two papers cited (`2604.09443`, `2602.05892`) are about *instruction hierarchy* and *context‑retrieval evaluation*, respectively — not direct prompt‑compression work. They are nevertheless highly relevant: the first warns that adding more instruction layers degrades reliability (motivating §7 hygiene), and the second shows agents over‑retrieve (motivating the "compress noise, not signal" stance in §6.4)[^7][^8].

---

## Footnotes

[^1]: Anthropic, *Prompt caching* docs, `https://platform.claude.com/docs/en/build-with-claude/prompt-caching` — covers `cache_control`, the `tools → system → messages` prefix order, automatic vs. explicit breakpoints (max 4 slots), 20‑block lookback window, 5‑minute and 1‑hour TTLs with 1.25×/2× write multipliers and 0.1× read multiplier, and per‑model pricing table.
[^2]: User‑authored `/Users/petercort/Documents/petercort/promptimizer/optimizations.md` — implementation checklist, `applyTo` scoping example, on‑demand skills, MCP profile pruning, session‑lifecycle operating model (scoped intent → checkpoint → prune → restart → retrieve over repeat), and quality/usage review cadence.
[^3]: Jiang et al., *LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models*, arXiv:2310.05736 (Microsoft) — token‑level pruning using a small LM scorer; up to ~20× compression at modest quality loss.
[^4]: Pan et al., *LLMLingua‑2: Data Distillation for Efficient and Faithful Task‑Agnostic Prompt Compression*, arXiv:2403.12968 — distills compression into a token‑classification model; faster and task‑agnostic.
[^5]: Jiang et al., *LongLLMLingua: Accelerating and Enhancing LLMs in Long Context Scenarios via Prompt Compression*, arXiv:2310.06839 — question‑aware coarse‑to‑fine compression for long contexts/RAG.
[^6]: Li, *Compressing Context to Enhance Inference Efficiency of Large Language Models* (Selective Context), arXiv:2310.06201 — drops low self‑information units using a base LM's surprisal.
[^7]: Zhang et al., *Many‑Tier Instruction Hierarchy* (ManyIH) and ManyIH‑Bench, arXiv:2604.09443v1 — frontier models drop to ~40% accuracy when navigating up to 12 conflicting instruction levels across 853 agentic tasks; argues against unbounded instruction stacks.
[^8]: Li et al., *ContextBench*, arXiv:2602.05892v1 — process‑oriented evaluation of context retrieval across 1,136 issue‑resolution tasks in 66 repos; finds LLM coding agents favor recall over precision and explore much more context than they actually use.
[^9]: VS Code Copilot logging — `Developer: Set Log Level → Trace`, **Output → GitHub Copilot Chat**, and `code --log trace` log directory (per VS Code Output panel docs and Copilot troubleshooting guidance).
[^10]: OpenAI `tiktoken` library (`pip install tiktoken`, `encoding = tiktoken.get_encoding("cl100k_base")`) — encode each section independently and sum, optionally rendering as a bar chart with `matplotlib`. For Anthropic models, prefer the `messages.count_tokens` endpoint for byte‑accurate accounting that includes tool schemas.
