// Orchestrator. Ingest -> classify -> tokenize -> stability -> recommend.

import { classifyBlocks } from './classify';
import { computeStability } from './diff';
import {
  ingestCopilotChatLogs,
  ingestCopilotHistorySessions,
  ingestCopilotSessions,
  ingestFromLogEntries,
  ingestHar,
  ingestJsonl,
  ingestVscodeDebugLogs,
  LogEntryLike,
} from './ingest';
import { runRules } from './recommend';
import {
  HeuristicTokenizer,
  Tokenizer,
  tokenizeBlocks,
} from './tokenize';
import {
  IngestedSession,
  PricingModel,
  PromptimizerResult,
  RawTurn,
} from './types';

/** Source descriptor accepted by {@link runPromptimizer}. */
export type PromptimizerSource =
  | { type: 'copilot-chat' }
  | { type: 'copilot-sessions' }
  | { type: 'copilot-history' }
  | { type: 'vscode-debug-logs' }
  | { type: 'jsonl'; path: string }
  | { type: 'har'; path: string }
  | { type: 'log-entries'; entries: readonly LogEntryLike[] };

export interface RunPromptimizerOptions {
  sources: PromptimizerSource[];
  tokenizer?: Tokenizer;
  model?: PricingModel;
}

function classifySession(session: IngestedSession): IngestedSession {
  for (const turn of session.turns) {
    const rawTurn: RawTurn = {
      session_id: session.session_id,
      turn: turn.turn,
      model: turn.model ?? session.model,
      blocks: turn.blocks,
    };
    turn.blocks = classifyBlocks(rawTurn);
  }
  return session;
}

function tokenizeSession(session: IngestedSession, tokenizer: Tokenizer): IngestedSession {
  for (const turn of session.turns) {
    tokenizeBlocks(turn.blocks, tokenizer);
  }
  return session;
}

/** Run the Promptimizer pipeline end-to-end. */
export function runPromptimizer(opts: RunPromptimizerOptions): PromptimizerResult {
  if (!opts || !Array.isArray(opts.sources)) {
    throw new Error('runPromptimizer: sources array is required');
  }
  const tokenizer = opts.tokenizer ?? new HeuristicTokenizer();
  const model: PricingModel = opts.model ?? 'claude-sonnet-4.6';

  const sessions: IngestedSession[] = [];
  for (const src of opts.sources) {
    switch (src.type) {
      case 'copilot-chat':
        sessions.push(...ingestCopilotChatLogs());
        break;
      case 'copilot-sessions':
        sessions.push(...ingestCopilotSessions());
        break;
      case 'copilot-history':
        sessions.push(...ingestCopilotHistorySessions());
        break;
      case 'vscode-debug-logs':
        sessions.push(...ingestVscodeDebugLogs());
        break;
      case 'jsonl':
        sessions.push(...ingestJsonl(src.path));
        break;
      case 'har':
        sessions.push(...ingestHar(src.path));
        break;
      case 'log-entries':
        sessions.push(...ingestFromLogEntries(src.entries));
        break;
      default: {
        const bad = src as { type: string };
        throw new Error(`runPromptimizer: unknown source type ${bad.type}`);
      }
    }
  }

  for (const s of sessions) {
    classifySession(s);
    tokenizeSession(s, tokenizer);
  }
  computeStability(sessions);

  const findings = runRules(sessions, model);
  return { sessions, findings, model };
}

export * from './types';
export { HeuristicTokenizer, tokenizeBlocks, createTokenizer, registerTokenizer } from './tokenize';
export { classifyBlock, classifyBlocks } from './classify';
export { ingestCopilotChatLogs, ingestCopilotHistorySessions, ingestCopilotSessions, ingestFromLogEntries, ingestHar, ingestJsonl, ingestVscodeDebugLogs, parseShutdownMetrics, parseContextWindowSnapshots, parseVscodeDebugLog } from './ingest';
export type { LogEntryLike } from './ingest';
export { computeStability, hashBlock, stableTurns } from './diff';
export {
  cacheSavingsUsdPer100Turns,
  cachedCostUsdPer100Turns,
  costModelFor,
  estimateUsdPer100Turns,
  rateFor,
} from './cost';
export { runRules, registerRuleSet, scoreFinding } from './recommend';
export { runCachingRules } from './recommend/caching';
