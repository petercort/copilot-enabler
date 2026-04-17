// Tokenization strategies. v1 ships a heuristic (chars/4); future revisions
// can plug in tiktoken or Anthropic's messages.count_tokens via the same
// interface.

import { Block } from './types';

/** Pluggable tokenizer contract. Implementations must be deterministic. */
export interface Tokenizer {
  /** Short stable identifier (e.g. `heuristic`, `tiktoken`). */
  readonly id: string;
  /** Count tokens for a single block's `text`. */
  countBlock(block: Block): number;
}

/**
 * Abstract base for future tokenizer plugins (`TiktokenTokenizer`,
 * `AnthropicCountTokenizer`). v1 never constructs these — they are declared
 * here purely as extension points.
 */
export abstract class BaseTokenizer implements Tokenizer {
  abstract readonly id: string;
  abstract countBlock(block: Block): number;
}

/**
 * Deterministic heuristic: `ceil(chars / 4)`. Per §4.1 we must tokenize each
 * block individually rather than the concatenated string, so the heuristic
 * operates on `block.text` only.
 */
export class HeuristicTokenizer extends BaseTokenizer {
  readonly id = 'heuristic';

  countBlock(block: Block): number {
    if (!block || typeof block.text !== 'string') {
      throw new Error(`HeuristicTokenizer: block ${block?.id} has no text`);
    }
    if (block.text.length === 0) { return 0; }
    return Math.ceil(block.text.length / 4);
  }
}

/** Factory signature — v2 tokenizers can be registered through this. */
export type TokenizerFactory = () => Tokenizer;

/** Registry of known factories. v1 only registers the heuristic. */
const registry: Record<string, TokenizerFactory> = {
  heuristic: () => new HeuristicTokenizer(),
};

/** Register a tokenizer factory under a stable id. */
export function registerTokenizer(id: string, factory: TokenizerFactory): void {
  if (!id) { throw new Error('registerTokenizer: id is required'); }
  registry[id] = factory;
}

/** Build a tokenizer by id. Throws on unknown ids. */
export function createTokenizer(id: string): Tokenizer {
  const f = registry[id];
  if (!f) { throw new Error(`Unknown tokenizer: ${id}`); }
  return f();
}

/** Tokenize every block in place (per-block). Returns the same array.
 *  Blocks with a pre-set positive `tokens` value (authoritative from ingest,
 *  e.g. outputTokens / totalTokens from events.jsonl) are preserved as-is. */
export function tokenizeBlocks(blocks: Block[], tokenizer: Tokenizer): Block[] {
  for (const b of blocks) {
    if (typeof b.tokens === 'number' && b.tokens > 0) { continue; }
    b.tokens = tokenizer.countBlock(b);
  }
  return blocks;
}
