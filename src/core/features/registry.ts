// Registry barrel - collects all feature definitions
// This file is automatically updated when you run `npm run new-feature`

import { FeatureDefinition } from './definition';
import { coreAskMode } from './core/core-ask-mode';
import { coreAgentMode } from './core/core-agent-mode';
import { corePlanMode } from './core/core-plan-mode';
import { coreChatPanel } from './core/core-chat-panel';
import { coreQuick } from './core/core-quick';
import { coreModelSelection } from './core/core-model-selection';
import { toolsWorkspace } from './tools/tools-workspace';
import { toolsTerminal } from './tools/tools-terminal';
import { toolsVscode } from './tools/tools-vscode';
import { coreInlineCompletion } from './core/core-inline-completion';
import { coreNes } from './core/core-nes';
import { coreMultilineCompletes } from './core/core-multiline-completes';
import { copilotInstructions } from './customization/copilot-instructions';
import { customPromptFiles } from './customization/custom-prompt-files';
import { customSkills } from './customization/custom-skills';
import { customAgents } from './customization/custom-agents';
import { customHooks } from './customization/custom-hooks';
import { toolsSelection } from './tools/tools-selection';
import { toolsCodebase } from './tools/tools-codebase';
import { toolsProblems } from './tools/tools-problems';
import { customMcpServers } from './customization/custom-mcp-servers';
import { toolsWebSearch } from './tools/tools-web-search';
import { coreSubagent } from './core/core-subagent';
import { coreSmartActions } from './core/core-smart-actions';
import { coreBackgroundAgents } from './core/core-background-agents';
import { coreCloudAgents } from './core/core-cloud-agents';
import { toolsChanges } from './tools/tools-changes';
import { customInstructions } from './customization/custom-instructions';
import { coreAutopilot } from './core/core-autopilot';
import { toolsImageBinary } from './tools/tools-image-binary';
import { coreChronicle } from './core/core-chronicle';
import { coreCliRemote } from './core/core-cli-remote';
// ── END IMPORTS ──

/**
 * All registered feature definitions.
 * Import new feature files above the END IMPORTS marker, then add to the array.
 */
export const allFeatureDefinitions: FeatureDefinition[] = [
  // ── Core ──
  coreAgentMode,
  coreAskMode,
  corePlanMode,
  coreChatPanel,
  coreSubagent,
  coreBackgroundAgents,
  coreCloudAgents,
  coreAutopilot,
  coreChronicle,
  coreCliRemote,
  toolsWorkspace,
  toolsTerminal,
  toolsVscode,
  // ── Tools ──
  coreInlineCompletion,
  coreQuick,
  coreSmartActions,
  coreMultilineCompletes,
  coreNes,
  coreModelSelection,
  toolsSelection,
  toolsCodebase,
  toolsProblems,
  toolsWebSearch,
  toolsChanges,
  toolsImageBinary,
  // ── Customization ──
  copilotInstructions,
  customPromptFiles,
  customSkills,
  customAgents,
  customMcpServers,
  customHooks,
  customInstructions,
  // ── END DEFINITIONS ──
];

/**
 * Get all feature definitions
 */
export function getFeatureDefinitions(): FeatureDefinition[] {
  return allFeatureDefinitions;
}
