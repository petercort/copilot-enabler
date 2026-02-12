// Port of internal/agents/modes.go

import { Agent, AgentReport, AnalysisContext } from './agent';
import { mergeHints, featureDetected, featureNames, buildRecommendation } from './helpers';

/** AgentsAgent evaluates which Copilot agent features the user is engaging with. */
export class ModesAgent implements Agent {
  name(): string {
    return 'Agents';
  }

  description(): string {
    return 'Analyzes Copilot agent usage (Agent / Ask / Edit / Plan / Background / Cloud)';
  }

  analyze(ctx: AnalysisContext): AgentReport {
    const report: AgentReport = {
      agentName: this.name(),
      summary: '',
      featuresUsed: [],
      featuresUnused: [],
      recommendations: [],
      score: 0,
    };

    const allHints = mergeHints(
      ctx.logSummary.detectedHints,
      ctx.settings.detectedHints,
      ctx.workspace.detectedHints,
      ctx.extensions.detectedHints,
    );

    for (const f of ctx.featureCatalog) {
      if (f.category !== 'Agents') {
        continue;
      }
      if (featureDetected(f, allHints)) {
        report.featuresUsed.push(f);
      } else {
        report.featuresUnused.push(f);
      }
    }

    const total = report.featuresUsed.length + report.featuresUnused.length;
    if (total > 0) {
      report.score = Math.floor((report.featuresUsed.length * 100) / total);
    }

    for (const f of report.featuresUnused) {
      report.recommendations.push(buildRecommendation(f, 'Try'));
    }

    const usedNames = featureNames(report.featuresUsed);
    if (usedNames.length === 0) {
      report.summary = 'No Copilot agent usage detected yet. Explore powerful agent features!';
    } else {
      report.summary = `Using ${report.featuresUsed.length} of ${total} agent features: ${usedNames.join(', ')}.`;
    }

    return report;
  }
}
