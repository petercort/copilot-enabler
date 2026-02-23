// Port of internal/agents/modes.go

import { Agent, AgentReport, AnalysisContext } from './agent';
import { mergeHints, featureDetected, featureNames, buildRecommendation } from './helpers';

/** CoreAgent evaluates which core Copilot features the user is engaging with. */
export class CoreAgent implements Agent {
  name(): string {
    return 'Core';
  }

  description(): string {
    return 'Analyzes core Copilot usage (Agent / Ask / Edit / Plan / Background / Cloud)';
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
      if (f.category !== 'Core' || f.detectHints.length === 0) {
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
      report.summary = 'No core Copilot feature usage detected yet. Explore powerful agent features!';
    } else {
      report.summary = `Using ${report.featuresUsed.length} of ${total} core features: ${usedNames.join(', ')}.`;
    }

    return report;
  }
}
