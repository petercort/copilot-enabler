// Type schema for Promptimizer. Mirrors §3 (ingest) and §8 (finding) of
// docs/copilot-research-i-would-like-to-create-a-program-that-is-designed.md.

/** Supported block categories per §4.2. */
export type BlockCategory =
  | 'system'
  | 'custom_instruction'
  | 'skill'
  | 'agent'
  | 'sub_agent'
  | 'mcp_tool'
  | 'built_in_tool'
  | 'user_message'
  | 'assistant_message'
  | 'tool_result'
  | 'attachment'
  | 'cache_control_overhead';

/** Anthropic cache-control metadata attached to a block. */
export interface CacheControl {
  type: 'ephemeral';
  ttl?: '5m' | '1h';
}

/** A single contributor to the prompt context window. */
export interface Block {
  id: string;
  category: BlockCategory;
  text: string;
  tokens?: number;
  hash?: string;
  stable?: boolean;
  cache_control?: CacheControl;
  /** `applyTo` glob for custom_instruction blocks. */
  applyTo?: string;
  /** MCP server name for `mcp_tool` blocks. */
  server?: string;
  /** Tool / skill / agent logical name. */
  name?: string;
  /** Arbitrary structured data for schemas / attachments. */
  meta?: Record<string, unknown>;
}

/** A raw turn before classification has run. */
export interface RawTurn {
  session_id: string;
  turn: number;
  model?: string;
  blocks: Block[];
}

/** A classified and tokenized turn. */
export interface IngestedTurn {
  session_id: string;
  turn: number;
  model?: string;
  blocks: Block[];
}

/** A full session = ordered turns sharing a session_id. */
export interface IngestedSession {
  session_id: string;
  model?: string;
  turns: IngestedTurn[];
  /** Human-friendly label, e.g. "owner/repo@branch — first prompt…". */
  label?: string;
  /** Structured context captured from the source (cwd, branch, repo, etc.). */
  context?: Record<string, string>;
  /** First user message, truncated — useful as a one-line summary. */
  firstPrompt?: string;
  /** Earliest ISO timestamp observed in the session, if known. */
  startedAt?: string;
}

/** Supported Anthropic model identifiers for the pricing table. */
export type PricingModel =
  | 'claude-sonnet-4.6'
  | 'claude-sonnet-4.5'
  | 'claude-opus-4.7'
  | 'claude-opus-4.6';

/** Pricing tier within one model, per §5.2. */
export type PricingTier = 'fresh' | 'write5m' | 'write1h' | 'read';

/** Per-model USD-per-MTok rates at each tier. */
export interface CostModel {
  model: PricingModel;
  fresh: number;
  write5m: number;
  write1h: number;
  read: number;
}

/** Savings estimate block of a finding, per §8. */
export interface EstimatedSavings {
  tokens_per_turn: number;
  usd_per_100_turns: number;
  input_token_share_after: number;
}

/** Quality-risk label, per §8. */
export type QualityRisk = 'none' | 'low' | 'medium' | 'high';

/** Forward-compat (v2) patch descriptor retained in v1 schema. */
export interface FindingPatch {
  type: string;
  after_block?: string;
  before_block?: string;
  ttl?: '5m' | '1h';
  [key: string]: unknown;
}

/** Evidence gathered by the rule for reviewer confidence. */
export interface FindingEvidence {
  blocks: string[];
  stable_turns?: number;
  tokens?: number;
  [key: string]: unknown;
}

/** Finding emitted by the recommendation engine. Mirrors §8 exactly. */
export interface Finding {
  rule: string;
  category: 'caching' | 'authoring' | 'hygiene' | 'compression';
  evidence: FindingEvidence;
  estimated_savings: EstimatedSavings;
  quality_risk: QualityRisk;
  auto_applicable: boolean;
  patch?: FindingPatch;
  /** Human-readable summary (non-normative, for UI). */
  message?: string;
}

/** Top-level result returned by `runPromptimizer`. */
export interface PromptimizerResult {
  sessions: IngestedSession[];
  findings: Finding[];
  model: PricingModel;
}
