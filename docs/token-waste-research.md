# Research: Identifying Token Waste and Optimizing Prompts

Based on industry research from OpenAI's Prompt Engineering guidelines, Anthropic's Claude documentation, and recent papers on LLM context windows (like the "Lost in the Middle" phenomenon), here is a comprehensive analysis of token waste and optimization techniques. 

Since this workspace is building a **Promptimizer** (`src/core/promptimizer`), these techniques are tailored so they can be directly implemented into the tool's feature set.

---

## Part 1: Executable Techniques (Can be automated in code)

These are structural inefficiencies that can be systematically identified and stripped out by a script/analyzer before the payload is sent to the LLM.

### 1. Format & Schema Bloat (JSON vs. YAML/TypeScript)
LLMs use tokenizers (like `tiktoken` or SentencePiece) that map common programmatic structures to tokens. JSON is notoriously token-heavy due to repetitive quotes, brackets, and commas. 
*   **Identify:** Scan MCP tool definitions, few-shot examples, or custom instructions that use heavily nested JSON schemas or verbose XML. Calculate the token-to-information ratio.
*   **Solve:** Minify the payload format. Convert JSON schemas into YAML or TypeScript `interface` definitions. 
    *   *Example:* An MCP tool defined using JSON Schema might take 300 tokens. Converting that schema to a TypeScript type definition with JSDoc comments can drop the cost to 120 tokens, and LLMs actually understand TypeScript types *better* because of their strong presence in training data.

### 2. Vector/Semantic Clashing (Context Deduplication)
When multiple RAG tools, skills, and memory systems inject context, they often inject overlapping information (e.g., the workspace scanner includes the `package.json` dependencies, but a custom MCP tool also dumps the dependencies).
*   **Identify:** Run a lightweight semantic similarity check (or exact substring Jaccard similarity) across all strings assembled for the final payload. If the similarity between an injected Skill and a Workspace Context chunk exceeds a threshold (e.g., 85%), it implies token waste.
*   **Solve:** Implement a deduplicator in your execution pipeline. If two context chunks are nearly identical, merge them or drop the one with lower precedence constraint. 

### 3. Low Return-on-Tokens (RoT) for Tools
Every loaded MCP tool or subagent consumes tokens *every single turn* via its description, even if it is never called.
*   **Identify:** Create telemetry that logs `(Token Cost of Tool Schema) * (Total Turns in Session)`. Compare this against actual tool invocation frequency. 
*   **Solve:** Implement **Lazy tool loading**. Use the active file extension or a cheap routing query to decide which tools to load. 
    *   *Example:* Do not inject the "GitHub PR Creator" MCP tool schema until the user explicitly mentions "PR", "commit", or "review", or until the current git diff is not empty.

### 4. "Fat" Code Ingestion (AST Skeletonizing)
Passing entire large files as context when only a single class or function signature is needed.
*   **Identify:** Count the tokens of ingested files versus the tokens of the lines the LLM actually suggests changes for or references.
*   **Solve:** Before attaching a large file, run it through an AST parser (like Tree-sitter) to strip out function bodies, leaving only imports, class definitions, and function signatures. Only include the full body of the specific function being discussed.

### 5. Flat Instruction Hierarchies (Privilege Confusion)
Recent research on "Many-Tier Instruction Hierarchies" (ManyIH) reveals that passing instructions from many flat sources (System Prompt + MCP Descriptions + Skill Files + Agentic Memory) causes massive resolution degradation (drop to ~40% accuracy footprint). When instructions conflict in flat payloads, LLMs freeze or hallucinate.
*   **Identify:** Payloads where tool schemas, workspace guidelines, and system prompts are concatenated at the same metadata tier.
*   **Solve:** Encode strict XML hierarchical bounds enforcing privilege (e.g., `<system_override>` > `<workspace_skill>` > `<user_tool>`). This allows the LLM to discard contradicting tokens faster, freeing latent space processing. 

### 6. Evidence Drop & Iterative Distraction
As shown in *ContextBench*, heavily scaffolded coding agents often grab the *correct* context into their context window, but lose it ("Evidence Drop") because they grab *too much* horizontal context in parallel. 
*   **Identify:** A tool or scanner that aggressively retrieves full file contents for 5+ files at once (maximizing recall but sacrificing precision).
*   **Solve:** Limit retrieval to definition-level AST blocks. Force the agent to retrieve in smaller rounds. As proven in the *ContextBench* benchmarks, models like Claude Sonnet perform best when enforcing moderate retrieval rounds with tightly constrained line counts per round, avoiding "greedy" large-file extraction.

### 7. Context/Prompt Caching Optimization
Modern LLM APIs (like Anthropic's Claude and OpenAI's GPT-4o) support **Prompt Caching**, which significantly discounts tokens if the exact string prefix has been seen recently. Token "waste" isn't strictly about removal, but about cache invalidation.
*   **Identify:** Dynamic instructions or date/time stamps injected at the *top* of the system prompt, which invalidates the KV cache of the massive following ruleset on every single turn.
*   **Solve:** Architect the context payload so that static, immutable instructions (Workspace rules, MCP definitions, system prompts) are placed at the beginning of the context window. Push dynamic variables (current file diffs, chat history, timestamps) to the very end of the payload.

### 8. Lexical & Algorithmic Compression (e.g., LLMLingua)
Token waste often consists of redundant stop-words, whitespace, or syntactical fluff in server logs, JSON traces, or documentations.
*   **Identify:** Large blocks of `git diff` outputs, server error stack traces, or raw markdown documentation being passed with significant whitespace and conversational filler.
*   **Solve:** Run the text through a lexical compressor (like Microsoft's *LLMLingua*) before submission. This drops non-essential tokens (like "the", "a", or excess spaces) based on entropy algorithms, preserving the semantic meaning while shrinking the sequence length by up to 50%.

### 9. Pruning "Breadcrumb" Waste (Diagnostic Dumps)
When developers ask for fixes based on terminal output, they often blindly paste 500+ line crash logs. 
*   **Identify:** Terminal tool histories or error payloads containing repeated loops, loading bars, warnings, or dependency resolution messages.
*   **Solve:** Before ingest, filter out lines containing strings like "Warning:", "Deprecation:", or download progress bars. Pass only the head (startup command) and the tail (fatal error signature) of the console output.

---

## Part 2: Behavioral Techniques (Prompt Engineering Best Practices)

These address the psychological and structural ways humans interact with and write for LLMs.

### 1. The Recall-vs-Precision Trap
Users often create custom instructions that demand LLMs read the *entire* codebase or pull *all* examples. *ContextBench* proved this is a fallacy: LLMs eagerly prioritize *context recall* (pulling everything) over *precision*, introducing terminal noise that degrades the final codebase patch.
*   **Identify:** Instructions saying "always read the entire `src/` folder" or "scan all tests before writing."
*   **Solve:** Rewrite instructions to favor tight, sequential probing: "Find the exact line of the failing test, then retrieve only that 1 function definition." Keep the context precise.

### 2. Performative Fluff & "Jedi Mind Tricks"
*Are phrases like "You are a staff software engineer" or "Be concise" necessary?* 
Generally, **no**. In early pre-RLHF models (like GPT-3), personas helped navigate the latent space to higher-quality code representations. Modern models are heavily fine-tuned to be helpful assistants. 
*   **Identify:** Look for qualitative adverbs, flattery, and overly polite framing: "Please could you...", "You are an expert 10x developer...", "Think deeply and carefully."
*   **Solve:** Replace qualitative framing with **concrete, structural constraints**. 
    *   *Instead of:* "Be concise and don't babble."
    *   *Use:* "Output only the modified code block. Do not output markdown explanations."
    *   *Instead of:* "You are an expert TypeScript developer."
    *   *Use:* "Write strict ES2022 TypeScript. Favor early returns. Do not use `any`."

### 2. The "Lost in the Middle" Phenomenon
Research by Liu et al. (2023) demonstrated that LLMs have a U-shaped attention curve. They recall the very beginning of the prompt (system instructions) and the very end (latest user message) perfectly, but ignore the middle (tool definitions, older chat history).
*   **Identify:** A chat session that exceeds 10+ turns where the user complains the LLM is "forgetting" rules or hallucinating tool requirements.
*   **Solve:** Implement aggressive context window pruning. 
    *   Drop the middle turns of the conversation completely. Keep the last 2-3 turns, plus a highly compressed summary of the older turns (e.g., `"User previously set up the Express router and configured middleware. Current focus involves testing."`).

### 3. Over-Positive Exhortations (Rule Bloat)
Adding multiple instructions telling the LLM what *to do* instead of what *not to do*. LLMs process negative constraints more efficiently when combined with a clear output format.
*   **Identify:** A `custom-instructions.md` file that has 50 bullet points of minor style preferences.
*   **Solve:** Condense rule sets. Group related instructions into a single constraint. Use linters to solve formatting, not LLMs. LLMs should solve logic, while tools like `eslint` or `prettier` solve spacing. Remove any instruction that a linter handles automatically.

### 3. The "Attention Sink" Phenomenon
As conversational history grows, LLMs allocate significant attention weights to early tokens (the "Attention Sink") and the most recent tokens. Intermediate system reminders or older but relevant task constraints get diluted.
*   **Identify:** A long session where earlier architectural guidelines start being ignored by the LLM in late-stage coding tasks. 
*   **Solve:** Periodically "re-state" or "refresh" the highest-priority constraint directly in the final user message, pulling it out of the diluted middle context (e.g., adding `[Reminder: Use explicit ES imports]` to the trailing chunk).

### 4. Over-Anchoring on Few-Shot Examples (Format vs. Content)
Adding dozens of examples for how an LLM should respond actually causes token waste *and* behavioral drift. The model begins mirroring the exact content of the example rather than the new task.
*   **Identify:** Large few-shot prompt libraries that take up 1000+ tokens and lead to the LLM hallucinating names/variables from the example into the user's code.
*   **Solve:** Distil examples down to 1-2 extremely tight, minimal pairs, or abandon few-shot learning entirely for zero-shot JSON-schema constraints (which modern models process efficiently).

---

## Summary of Sources

When building out the rules for the `promptimizer/recommend` features in your extension, you can directly base your logic on these industry standards:

1.  **OpenAI Prompt Engineering Guide**: Emphasizes using specific formatting (like markdown delimiters or XML tags `<rule>`) to separate instructions from context instead of relying on long prose to delineate sections.
2.  **Anthropic's "Claude Prompt Engineering" Docs**: Explicitly notes that JSON triggers higher token usage and lower evaluation accuracy natively compared to XML constraints, and recommends avoiding redundant "please" and conversational filler.
3.  **"Lost in the Middle: How Language Models Use Long Contexts" (Liu et al., 2023)**: Proves that adding irrelevant context (bloated tools/instructions) actively *degrades* the model's ability to extract the correct answer, even if the total token count is below the maximum context window limit. Token waste is not just an optimization issue; it's a model accuracy issue.
4.  **"ContextBench: A Benchmark for Context Retrieval in Coding Agents" (2026)**: Discovers the "Bitter Lesson" of agentic scaffolding. Shows that models prioritize extreme recall over precision, leading to "Evidence Drop"—where they technically retrieve the correct problem snippet, but lose track of it due to the immense noise of surrounding whole-file context ingestion. 
5.  **"Many-Tier Instruction Hierarchy in LLM Agents" (2026)**: Highlights that unstructured context waste across many sources (System, Memory, User, Tools) without strict privilege grouping results in a ~40% accuracy drop. Prompt optimization must enforce strict hierarchical scoping to prevent rule clashing in large context windows.
6.  **"LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models" (Jiang et al., Microsoft, 2023)**: Proves that natural language and programmatic traces contain massive amounts of token entropy (waste) that can be computationally removed prior to LLM submission with minimal loss of information.
7.  **Anthropic / OpenAI API Pattern Documentation**: Standardized guides indicating that structure order (Static > Dynamic) is paramount for token reduction via KV Cache hit rates.

---

## Part 3: Well-Architected Static Analysis Rules and Suggestion Framework

This section converts the governance guidance from `well-architected-tokens.md` into checks and recommendation outputs that can be implemented directly in `src/core/promptimizer/staticScan.ts` and `src/core/promptimizer/recommend/*`.

### A. Static Analysis Rule Pack

Use these rules as deterministic analyzers. Each rule should return:

- `ruleId`
- `severity` (`low`, `medium`, `high`)
- `finding`
- `evidence` (line references or matched spans)
- `suggestion`
- `estimatedTokenImpact`

#### 1) Always-On Context Budget Rule
- **What to detect:** Oversized baseline instructions, tool schemas, and globally loaded skills.
- **Heuristic:** `alwaysOnTokens / totalPromptTokens > 0.35` (team-tunable threshold).
- **Why it matters:** Well-Architected guidance recommends a compact baseline and conditional loading.
- **Suggestion shape:** Recommend moving large instruction blocks to conditional artifacts with explicit triggers.

#### 2) applyTo Scope Coverage Rule
- **What to detect:** Global custom instructions without scoping patterns.
- **Heuristic:** Instruction entry exists but lacks a file/task scope field (or equivalent).
- **Why it matters:** Unscoped guidance increases cross-task noise and token waste.
- **Suggestion shape:** Add scoped patterns (for example `**/*.md`, `src/**`, task tags) and split unrelated guidance.

#### 3) Tool Catalog Utility Rule
- **What to detect:** Tool descriptions loaded in context but rarely invoked.
- **Heuristic:** High schema token footprint with low invocation count in telemetry.
- **Why it matters:** Tool schemas are recurring token tax across turns.
- **Suggestion shape:** Lazy-load tools based on intent routing, file type, or workflow mode.

#### 4) Session Hygiene Rule
- **What to detect:** Long threads with repeated retries and low novelty in context.
- **Heuristic:** High turn count + rising token usage + repeated constraints/history blocks.
- **Why it matters:** Degraded quality often comes from stale middle context.
- **Suggestion shape:** Generate a restart summary with active constraints and drop stale artifacts.

#### 5) Retrieval Precision Rule
- **What to detect:** Large, repeated full-file context ingestion.
- **Heuristic:** Multiple files attached in full where only symbol-level edits are requested.
- **Why it matters:** Precision retrieval outperforms greedy whole-file retrieval in coding workflows.
- **Suggestion shape:** Switch to definition-level extraction first, then progressively expand only on demand.

#### 6) Context Duplication Rule
- **What to detect:** Near-duplicate chunks across skills, memory, workspace excerpts, and tool docs.
- **Heuristic:** Similarity above threshold (for example 0.85+) or high normalized overlap.
- **Why it matters:** Duplicate tokens displace useful active context.
- **Suggestion shape:** Keep the highest-precedence source and remove redundant copies.

#### 7) Prompt Cache Stability Rule
- **What to detect:** Dynamic fields inserted before static instruction blocks.
- **Heuristic:** Volatile values (timestamps, changing IDs, ephemeral metadata) near prompt prefix.
- **Why it matters:** Prefix instability reduces prompt caching effectiveness.
- **Suggestion shape:** Reorder payload to `Static -> Semi-static -> Dynamic`.

### B. Suggestion Templates (Output-Ready)

Recommendations should be concrete, prioritized, and measurable. Use this response shape:

```json
{
    "title": "Reduce always-on context share",
    "priority": "high",
    "problem": "Always-on instruction payload is 43% of total context window.",
    "action": "Move formatting examples and niche playbooks into conditional skill files loaded by task trigger.",
    "expectedImpact": {
        "tokenReductionEstimate": "8-15%",
        "qualityImpact": "Lower retry rate on mixed-task sessions"
    },
    "validation": "Track alwaysOnTokens ratio and retry rate for 2 weeks after rollout."
}
```

### C. Priority Model for Recommendations

To avoid noisy advice, rank findings with an impact score:

$$
priorityScore = (tokenWastePercent * 0.45) + (qualityRisk * 0.35) + (frequency * 0.20)
$$

Where:

- `tokenWastePercent`: Estimated removable context share.
- `qualityRisk`: Probability that waste causes degraded output quality.
- `frequency`: How often the pattern appears in observed sessions.

Suggested bands:

- `high`: $priorityScore \ge 0.70$
- `medium`: $0.40 \le priorityScore < 0.70$
- `low`: $priorityScore < 0.40$

### D. Operational Metrics to Attach to Each Suggestion

Align with Well-Architected operating cadence by attaching measurable outcomes:

- `alwaysOnContextShare`
- `toolSchemaTokensPerTurn`
- `duplicateContextPercent`
- `retryRate`
- `abandonmentRate`
- `acceptedOutputRate`

Each suggestion should specify a baseline, target, and review window (for example monthly).

### E. Suggested Integration Points in Promptimizer

- Extend `staticScan.ts` with rule evaluators and severity assignment.
- Extend `types.ts` with `StaticFinding`, `Suggestion`, and `ImpactEstimate` fields for telemetry-oriented outputs.
- Add recommendation generators under `recommend/` that convert findings into prioritized suggestion payloads.
- Reuse `cost.ts` for token impact estimates and `classify.ts` for confidence/priority normalization.

### F. Example Rule-to-Suggestion Mapping

1. **Finding:** Unscoped global markdown and code-style instruction files loaded on every task.
2. **Static result:** `applyTo_scope_missing` with medium-to-high severity.
3. **Generated suggestion:** Split by task type and file patterns; load docs guidance only for docs edits.
4. **Expected impact:** Reduced baseline tokens and lower cross-task instruction collisions.

This mapping helps keep recommendations prescriptive instead of generic.
