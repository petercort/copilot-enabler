// Registry barrel - collects all feature definitions
// This file is automatically updated when you run `npm run new-feature`

import { FeatureDefinition } from './definition';
import { modeAsk } from './agent-mode-ask';
import { modeEdit } from './agent-mode-edit';
import { modeAgent } from './agent-mode-agent';
import { modePlan } from './agent-mode-plan';
import { chatPanel } from './agent-chat-panel';
import { chatInline } from './chat-inline';
import { chatQuick } from './chat-quick';
import { settingModelSelection } from './chat-model-selection';
import { chatParticipantWorkspace } from './agent-participant-workspace';
import { chatParticipantTerminal } from './agent-participant-terminal';
import { chatParticipantVscode } from './agent-participant-vscode';
import { completionInline } from './chat-completion-inline';
import { completionNes } from './chat-completion-nes';
import { completionMultiline } from './chat-completion-multiline';
import { customInstructionsFile } from './custom-instructions-file';
import { customCopilotignore } from './custom-copilotignore';
import { customLanguageEnable } from './custom-language-enable';
import { customModeInstructions } from './custom-mode-instructions';
import { customPromptFiles } from './custom-prompt-files';
import { customAgentSkills } from './custom-agent-skills';
import { customAgents } from './custom-agents';
import { customHooks } from './custom-hooks';
import { contextFile } from './chat-context-file';
import { contextSelection } from './chat-context-selection';
import { contextCodebase } from './chat-context-codebase';
import { contextProblems } from './chat-context-problems';
import { skillMcpServers } from './custom-mcp-servers';
import { webSearch } from './chat-web-search';
import { runSubAgent } from './agent-subagent';
import { smartActions } from './chat-smart-actions';
import { agentBackground } from './agent-background';
import { agentCloud } from './agent-cloud';
// ── END IMPORTS ──

/**
 * All registered feature definitions.
 * Import new feature files above the END IMPORTS marker, then add to the array.
 */
export const allFeatureDefinitions: FeatureDefinition[] = [
  // ── Agents ──
  modeAgent,
  modeAsk,
  modeEdit,
  modePlan,
  chatPanel,
  runSubAgent,
  agentBackground,
  agentCloud,
  chatParticipantWorkspace,
  chatParticipantTerminal,
  chatParticipantVscode,
  // ── Chat ──
  chatInline,
  chatQuick,
  smartActions,
  completionInline,
  completionMultiline,
  completionNes,
  settingModelSelection,
  contextFile,
  contextSelection,
  contextCodebase,
  contextProblems,
  webSearch,
  // ── Customization ──
  customInstructionsFile,
  customModeInstructions,
  customPromptFiles,
  customAgentSkills,
  customAgents,
  skillMcpServers,
  customHooks,
  customCopilotignore,
  customLanguageEnable,
  // ── END DEFINITIONS ──
];

/**
 * Get all feature definitions
 */
export function getFeatureDefinitions(): FeatureDefinition[] {
  return allFeatureDefinitions;
}
