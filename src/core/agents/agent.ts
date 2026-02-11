// Port of internal/agents/agent.go

import { Feature, Category } from '../featureCatalog';
import { LogEntry, LogSummary, SettingsResult, WorkspaceResult, ExtensionsResult } from '../scanner';

/** AnalysisContext bundles all collected data that agents use for analysis. */
export interface AnalysisContext {
  logEntries: LogEntry[];
  logSummary: LogSummary;
  settings: SettingsResult;
  workspace: WorkspaceResult;
  extensions: ExtensionsResult;
  featureCatalog: Feature[];
}

/** Recommendation is a single actionable suggestion for the user. */
export interface Recommendation {
  featureID: string;
  matrixScore: number;
  title: string;
  description: string;
  category: Category;
  actionItems: string[];
  docsURL: string;
  impact: string;
  difficulty: string;
  stars: string;
}

/** AgentReport is the output of an agent's analysis. */
export interface AgentReport {
  agentName: string;
  summary: string;
  featuresUsed: Feature[];
  featuresUnused: Feature[];
  recommendations: Recommendation[];
  score: number;
}

/** Agent is the interface every analysis agent must implement. */
export interface Agent {
  name(): string;
  description(): string;
  analyze(ctx: AnalysisContext): AgentReport;
}
