// Registry barrel - collects all feature definitions
// This file is automatically updated when you run `npm run new-feature`

import { FeatureDefinition } from './definition';
import { modeAsk } from './mode-ask';
import { modeEdit } from './mode-edit';
import { modeAgent } from './mode-agent';
import { chatPanel } from './chat-panel';
import { chatInline } from './chat-inline';
import { chatQuick } from './chat-quick';
import { settingModelSelection } from './setting-model-selection';
import { chatParticipantWorkspace } from './chat-participant-workspace';
import { chatParticipantTerminal } from './chat-participant-terminal';
import { chatParticipantVscode } from './chat-participant-vscode';
import { completionInline } from './completion-inline';
import { completionNes } from './completion-nes';
import { completionMultiline } from './completion-multiline';
import { customInstructionsFile } from './custom-instructions-file';
import { customCopilotignore } from './custom-copilotignore';
import { customLanguageEnable } from './custom-language-enable';
import { customModeInstructions } from './custom-mode-instructions';
import { customPromptFiles } from './custom-prompt-files';
import { customAgentSkills } from './custom-agent-skills';
import { customAgents } from './custom-agents';
import { contextFile } from './context-file';
import { contextSelection } from './context-selection';
import { contextCodebase } from './context-codebase';
import { contextProblems } from './context-problems';
import { skillMcpServers } from './skill-mcp-servers';

/**
 * All registered feature definitions.
 * Import new feature files here and add them to the array.
 */
export const allFeatureDefinitions: FeatureDefinition[] = [
  modeAsk,
  modeEdit,
  modeAgent,
  chatPanel,
  chatInline,
  chatQuick,
  settingModelSelection,
  chatParticipantWorkspace,
  chatParticipantTerminal,
  chatParticipantVscode,
  completionInline,
  completionNes,
  completionMultiline,
  customInstructionsFile,
  customCopilotignore,
  customLanguageEnable,
  customModeInstructions,
  customPromptFiles,
  customAgentSkills,
  customAgents,
  contextFile,
  contextSelection,
  contextCodebase,
  contextProblems,
  skillMcpServers,
];

/**
 * Get all feature definitions
 */
export function getFeatureDefinitions(): FeatureDefinition[] {
  return allFeatureDefinitions;
}
