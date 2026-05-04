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
import { scanCustomizationFiles } from './staticScan';
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
  /** Absolute workspace root paths to scan for customization files (optional). */
  workspaceRoots?: string[];
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

  // Source priority for deduplication: later entries win when raw session IDs collide.
  // Order matters — copilot-history (richest) should be processed last so it
  // overwrites the same session ingested from copilot-sessions or log-entries.
  const SOURCE_PRIORITY: Record<string, number> = {
    'log-entries': 0,
    'copilot-chat': 1,
    'vscode-debug-logs': 2,
    'jsonl': 3,
    'har': 3,
    'copilot-sessions': 4,
    'copilot-history': 5,
  };

  const rawSessions: IngestedSession[] = [];
  for (const src of opts.sources) {
    switch (src.type) {
      case 'copilot-chat':
        rawSessions.push(...ingestCopilotChatLogs());
        break;
      case 'copilot-sessions':
        rawSessions.push(...ingestCopilotSessions());
        break;
      case 'copilot-history':
        rawSessions.push(...ingestCopilotHistorySessions());
        break;
      case 'vscode-debug-logs':
        rawSessions.push(...ingestVscodeDebugLogs());
        break;
      case 'jsonl':
        rawSessions.push(...ingestJsonl(src.path));
        break;
      case 'har':
        rawSessions.push(...ingestHar(src.path));
        break;
      case 'log-entries':
        rawSessions.push(...ingestFromLogEntries(src.entries));
        break;
      default: {
        const bad = src as { type: string };
        throw new Error(`runPromptimizer: unknown source type ${bad.type}`);
      }
    }
  }

  // Deduplicate: strip source-type prefixes (e.g. "copilot-session:", "copilot-history:")
  // and keep the highest-priority session for each raw ID.
  const SESSION_PREFIX_RE = /^(?:copilot-session|copilot-history|copilot-chat|vscode-debug|jsonl|har|log-entry):/;
  function rawSessionId(id: string): string {
    return id.replace(SESSION_PREFIX_RE, '');
  }
  function sourcePriority(id: string): number {
    const prefix = id.split(':')[0];
    return SOURCE_PRIORITY[prefix] ?? -1;
  }

  const seen = new Map<string, IngestedSession>();
  for (const s of rawSessions) {
    const key = rawSessionId(s.session_id);
    const existing = seen.get(key);
    if (!existing || sourcePriority(s.session_id) > sourcePriority(existing.session_id)) {
      seen.set(key, s);
    }
  }
  const sessions = Array.from(seen.values());

  for (const s of sessions) {
    classifySession(s);
    tokenizeSession(s, tokenizer);
  }
  computeStability(sessions);

  const findings = runRules(sessions, model);
  const staticFindings = scanCustomizationFiles(opts.workspaceRoots ?? []);
  return { sessions, findings, model, staticFindings };
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
export { runHygieneRules, ruleFluff, ruleRuleBloat, ruleFewShot } from './recommend/hygiene';
export { runDeduplicationRules, ruleDeduplication } from './recommend/deduplication';
export { ruleMcpToolOverhead, ruleLostInMiddle } from './recommend/general';
export {
  scanCustomizationFiles,
  discoverCustomizationFiles,
  findDuplicatePairs,
  ruleFluffPhrases as staticRuleFluffPhrases,
  ruleRuleBloat as staticRuleRuleBloat,
  ruleFewShotOverload as staticRuleFewShotOverload,
} from './staticScan';
export type { DedupPair } from './staticScan';
