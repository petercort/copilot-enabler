// Classify raw turn blocks per §4.2. Input blocks may already carry a hint
// in `category` / `meta`; this pass normalises and fills in what is missing.

import { Block, BlockCategory, RawTurn } from './types';

const CATEGORY_VALUES: ReadonlySet<BlockCategory> = new Set<BlockCategory>([
  'system',
  'custom_instruction',
  'skill',
  'agent',
  'sub_agent',
  'mcp_tool',
  'built_in_tool',
  'user_message',
  'assistant_message',
  'tool_result',
  'attachment',
  'cache_control_overhead',
]);

function isBlockCategory(value: unknown): value is BlockCategory {
  return typeof value === 'string' && CATEGORY_VALUES.has(value as BlockCategory);
}

function normaliseCategory(raw: string): BlockCategory | undefined {
  const v = raw.trim().toLowerCase();
  switch (v) {
    case 'system':
    case 'system_prompt':
      return 'system';
    case 'custom_instruction':
    case 'custom_instructions':
    case 'instruction':
    case 'instructions':
      return 'custom_instruction';
    case 'skill':
    case 'skills':
      return 'skill';
    case 'agent':
      return 'agent';
    case 'sub_agent':
    case 'subagent':
      return 'sub_agent';
    case 'mcp_tool':
    case 'mcp':
      return 'mcp_tool';
    case 'tool':
    case 'built_in_tool':
    case 'builtin_tool':
      return 'built_in_tool';
    case 'user':
    case 'user_message':
    case 'messages.user':
      return 'user_message';
    case 'assistant':
    case 'assistant_message':
    case 'messages.assistant':
      return 'assistant_message';
    case 'tool_result':
    case 'messages.tool_result':
      return 'tool_result';
    case 'attachment':
    case 'image':
    case 'file':
      return 'attachment';
    case 'cache_control_overhead':
    case 'cache_control':
      return 'cache_control_overhead';
    default:
      return undefined;
  }
}

/**
 * Classify a single block. Preserves an already-valid `category`; otherwise
 * consults `meta.type`, `meta.role`, or block `name`/`server` hints to
 * decide. MCP tool blocks must carry a `server` attribution (§4.2).
 */
export function classifyBlock(block: Block): Block {
  if (!block || typeof block !== 'object') {
    throw new Error('classifyBlock: block is required');
  }
  if (typeof block.id !== 'string' || block.id.length === 0) {
    throw new Error('classifyBlock: block.id is required');
  }
  if (typeof block.text !== 'string') {
    throw new Error(`classifyBlock: block ${block.id} has no text`);
  }

  let category: BlockCategory | undefined = isBlockCategory(block.category)
    ? block.category
    : undefined;

  if (!category && typeof block.category === 'string') {
    category = normaliseCategory(block.category);
  }

  const metaType = block.meta && typeof block.meta['type'] === 'string'
    ? (block.meta['type'] as string)
    : undefined;
  if (!category && metaType) {
    category = normaliseCategory(metaType);
  }

  const metaRole = block.meta && typeof block.meta['role'] === 'string'
    ? (block.meta['role'] as string)
    : undefined;
  if (!category && metaRole) {
    category = normaliseCategory(metaRole);
  }

  if (!category && block.server) { category = 'mcp_tool'; }

  if (!category) {
    throw new Error(`classifyBlock: could not classify block ${block.id}`);
  }

  if (category === 'mcp_tool') {
    const server = block.server
      ?? (block.meta && typeof block.meta['server'] === 'string' ? (block.meta['server'] as string) : undefined);
    if (!server) {
      throw new Error(`classifyBlock: mcp_tool block ${block.id} missing server attribution`);
    }
    block.server = server;
  }

  block.category = category;
  return block;
}

/** Classify every block of a raw turn, returning a new block array. */
export function classifyBlocks(rawTurn: RawTurn): Block[] {
  if (!rawTurn || !Array.isArray(rawTurn.blocks)) {
    throw new Error('classifyBlocks: rawTurn.blocks must be an array');
  }
  return rawTurn.blocks.map(classifyBlock);
}
