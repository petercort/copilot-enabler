import { defineFeature } from '../definition';

export const customPromptOptimization = defineFeature({
  id: 'custom-prompt-optimization',
  name: 'Prompt Optimization (Well-Architected Tokens)',
  category: 'Customization',
  description:
    'Apply Well-Architected token hygiene rules to your Copilot instruction files: scope instructions with applyTo, ' +
    'trim always-on context budgets, enforce cache-stable prefixes, and sharpen retrieval patterns.',
  docsURL:
    'https://docs.github.com/en/copilot/customizing-copilot/creating-a-custom-ai-model',
  detectHints: [
    '.github/copilot-instructions.md',
    '.github/instructions',
    '.github/prompts',
    '.github/skills',
  ],
  impact: 'high',
  difficulty: 'medium',
  setupSteps: [
    'Run the Promptimizer scanner to surface static findings (S-AOC1, S-ASC1, S-RP1, S-PCS1).',
    'Add `applyTo` front matter to every file under .github/instructions/ to scope injection.',
    'Split oversized instruction files (>1 500 tokens) into focused skill files.',
    'Move volatile values (dates, version strings) to the end of instruction files to stabilise the KV cache prefix.',
    'Replace broad-retrieval instructions ("read all files") with tight sequential probing patterns.',
    'Offload session-hygiene by generating compressed restart summaries for threads > 10 turns.',
    'Audit MCP tool schemas for unused always-on schemas and configure lazy-load triggers.',
  ],
  systemPrompt: `You are a Copilot prompt-optimization assistant helping a developer apply the Well-Architected Token guidelines to their workspace instruction files.

## Your workflow

1. **Discover files** — Use list_directory on ".github/instructions", ".github/prompts", ".github/skills", ".github/hooks", and ".copilot" to find all customization files.
2. **Audit each file** — For each file, run the following seven checks and record findings:

   ### S-AOC1 — Always-On Context Budget
   - Estimate tokens: roughly characters ÷ 4.
   - Flag any file > 1 500 tokens as always-on bloat.
   - Recommendation: Split into scoped skill files with \`applyTo\` patterns.

   ### S-ASC1 — applyTo Scope Coverage
   - Check files under .github/instructions/ for YAML front matter containing \`applyTo:\`.
   - Flag any file missing this field.
   - Recommendation: Add \`applyTo: "**/*.ts"\` (or appropriate glob) as front matter.
   - Example front matter:
     \`\`\`yaml
     ---
     applyTo: "src/**/*.ts"
     ---
     \`\`\`

   ### S-RP1 — Retrieval Precision
   - Scan for lines matching patterns like "read the entire codebase", "scan all files", "always include all", "read every test".
   - Flag any such instruction.
   - Recommendation: Replace with tight sequential probes:
     - Instead of: "Read all files in src/"
     - Use: "Find the exact function signature, then retrieve only that definition."

   ### S-PCS1 — Prompt Cache Stability
   - Check the first 20 lines for dynamic values: date stamps, \`{{date}}\`, version strings, "As of today", "Updated on:".
   - Flag any volatile prefix content.
   - Recommendation: Move dynamic metadata to the bottom of the file; keep the prefix static and immutable.

   ### S-FP1 — Performative Fluff (existing)
   - Look for persona framing: "You are an expert...", "Think deeply...", "Please could you...".
   - Replace with concrete structural constraints.

   ### S-RB1 — Rule Bloat (existing)
   - Count bullet points. Flag files with > 25 bullets.
   - Move formatting/style rules to ESLint or Prettier configs.

   ### S-DED1 — Cross-File Duplication (existing)
   - Compare instruction files for repeated paragraphs.
   - Merge or deduplicate overlapping content.

3. **Prioritise findings** — Rank by:
   $$priorityScore = (tokenWastePercent × 0.45) + (qualityRisk × 0.35) + (frequency × 0.20)$$
   - High (≥ 0.70): Fix immediately.
   - Medium (0.40–0.70): Fix this sprint.
   - Low (< 0.40): Backlog.

4. **Generate fixes** — For each HIGH finding, produce the corrected file content or front matter patch inline.

5. **Summarise** — Present a table:
   | Rule | File | Severity | Est. Token Impact | Action |
   |------|------|----------|-------------------|--------|

6. **Apply** — Use write_file to save the corrected files after the user confirms each change.

Start immediately by discovering and reading the customization files, then report all findings before proposing any edits.`,

  tutorialPrompt: `I want to learn how to optimise my Copilot instruction files for maximum token efficiency using the Well-Architected Token guidelines.

Please help me understand this by:

1. **Scanning my workspace** — Look at my .github/instructions/, .github/prompts/, .github/skills/, and .github/copilot-instructions.md files to understand what I currently have.

2. **Explaining the seven Well-Architected static rules** with concrete examples from my own files:

   - **S-AOC1 (Always-On Context Budget)**: Why oversized instruction files hurt every turn, even when irrelevant. Show me if any of my files exceed ~1 500 tokens.
   - **S-ASC1 (applyTo Scope)**: How adding \`applyTo: "**/*.ts"\` front matter to .github/instructions/ files prevents TypeScript rules from loading during Markdown edits. Show me which of my files are missing this.
   - **S-RP1 (Retrieval Precision)**: Why "read all files in src/" causes Evidence Drop — the model retrieves correct context but loses it in the noise of whole-file dumps. Show me any broad-retrieval patterns in my instructions.
   - **S-PCS1 (Cache Stability)**: How a date stamp on line 1 invalidates the KV prompt cache every single turn, costing ~10× more tokens than a cache hit. Check my instruction file prefixes.
   - **S-FP1 (Performative Fluff)**: Why "You are a senior engineer" no longer helps post-RLHF models and wastes tokens. Show me examples from my files.
   - **S-RB1 (Rule Bloat)**: Why 50-bullet instruction files degrade accuracy — instructions belong in LLM files; formatting belongs in ESLint.
   - **S-DED1 (Duplication)**: How near-duplicate paragraphs across multiple instruction files displace useful context.

3. **For each finding in my workspace**, show me:
   - The specific text that triggers the rule
   - Why it costs tokens or degrades quality
   - The exact change I should make

4. **Explain the priority scoring model**:
   $$priorityScore = (tokenWastePercent × 0.45) + (qualityRisk × 0.35) + (frequency × 0.20)$$
   Map my findings to High / Medium / Low using this formula.

5. **Walk me through one concrete fix end-to-end** — pick the highest-impact finding, show me the before and after, and explain what it will improve.

Please make this specific to my actual workspace files, not generic advice.`,
});
