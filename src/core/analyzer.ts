// Port of internal/analyzer/analyzer.go

import { visibleCatalog } from './featureCatalog';
import { allAgents, AgentReport, Recommendation } from './agents';
import { LogEntry, LogSummary, SettingsResult, WorkspaceResult, ExtensionsResult, analyzeLogs } from './scanner';

/** Result is the unified output of the full analysis pipeline. */
export interface AnalysisResult {
  agentReports: AgentReport[];
  overallScore: number;
  totalFeatures: number;
  usedFeatures: number;
  topRecommendations: Recommendation[];
  logSummary: LogSummary;
}

/** Run executes all agents against the collected data and returns a unified result. */
export function runAnalysis(
  logEntries: LogEntry[],
  settings: SettingsResult,
  workspace: WorkspaceResult,
  extensions: ExtensionsResult,
): AnalysisResult {
  const featureCatalog = visibleCatalog();
  const logSummary = analyzeLogs(logEntries);

  const ctx = {
    logEntries,
    logSummary,
    settings,
    workspace,
    extensions,
    featureCatalog,
  };

  const reports: AgentReport[] = [];
  for (const agent of allAgents()) {
    reports.push(agent.analyze(ctx));
  }

  // Compute overall score as average of agent scores
  let totalScore = 0;
  for (const r of reports) {
    totalScore += r.score;
  }
  const overallScore = reports.length > 0 ? Math.floor(totalScore / reports.length) : 0;

  // Collect unique used feature IDs
  const usedSet = new Set<string>();
  for (const r of reports) {
    for (const f of r.featuresUsed) {
      usedSet.add(f.id);
    }
  }

  // Deduplicate recommendations across agents by feature ID
  const recSet = new Map<string, Recommendation>();
  for (const r of reports) {
    for (const rec of r.recommendations) {
      if (!recSet.has(rec.featureID)) {
        recSet.set(rec.featureID, rec);
      }
    }
  }

  // Sort by matrix score descending
  const allRecs = Array.from(recSet.values()).sort(
    (a, b) => b.matrixScore - a.matrixScore,
  );

  const limit = Math.min(5, allRecs.length);

  return {
    agentReports: reports,
    overallScore,
    totalFeatures: featureCatalog.length,
    usedFeatures: usedSet.size,
    topRecommendations: allRecs.slice(0, limit),
    logSummary,
  };
}
