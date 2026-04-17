// Block stability analysis per §3. Hashes each block's normalised text with
// SHA-256 and flags a block as `stable: true` when the same id retains the
// same hash across ≥2 consecutive turns.

import { createHash } from 'crypto';
import { Block, IngestedSession } from './types';

/** Normalise text before hashing: trim, collapse CRLF to LF. */
function normalise(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

/** Compute SHA-256 hex digest of a block's normalised text. */
export function hashBlock(block: Block): string {
  return createHash('sha256').update(normalise(block.text)).digest('hex');
}

/**
 * Walk every session and set `block.hash` on every block, plus `block.stable`
 * when the same id has an identical hash on the previous turn (i.e. the
 * block persisted unchanged across ≥2 consecutive turns).
 */
export function computeStability(sessions: IngestedSession[]): IngestedSession[] {
  if (!Array.isArray(sessions)) {
    throw new Error('computeStability: sessions must be an array');
  }

  for (const session of sessions) {
    let prev = new Map<string, string>();
    for (const turn of session.turns) {
      const next = new Map<string, string>();
      for (const block of turn.blocks) {
        const h = hashBlock(block);
        block.hash = h;
        const prevHash = prev.get(block.id);
        block.stable = prevHash !== undefined && prevHash === h;
        next.set(block.id, h);
      }
      prev = next;
    }
  }

  return sessions;
}

/**
 * For a given block id, count how many consecutive turns (ending at the last
 * turn of the session) kept the same hash. Returns 0 if the block is missing
 * on the final turn.
 */
export function stableTurns(session: IngestedSession, blockId: string): number {
  if (session.turns.length === 0) { return 0; }
  const last = session.turns[session.turns.length - 1];
  const lastBlock = last.blocks.find((b) => b.id === blockId);
  if (!lastBlock) { return 0; }
  const target = lastBlock.hash ?? hashBlock(lastBlock);

  let count = 0;
  for (let i = session.turns.length - 1; i >= 0; i--) {
    const b = session.turns[i].blocks.find((x) => x.id === blockId);
    if (!b) { break; }
    const h = b.hash ?? hashBlock(b);
    if (h !== target) { break; }
    count++;
  }
  return count;
}
