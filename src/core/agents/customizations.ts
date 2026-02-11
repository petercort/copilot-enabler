// Port of internal/agents/customizations.go

import { Agent, AgentReport, AnalysisContext } from './agent';
import { mergeHints, featureDetected, featureNames, buildRecommendation } from './helpers';

/** CustomizationsAgent evaluates how much the user has tailored Copilot. */
export class CustomizationsAgent implements Agent {
  name(): string {
    return 'Customizations';
  }

  description(): string {
    return 'Analyzes Copilot customizations (instructions, MCP, settings)';
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
      if (f.category !== 'Customization') {
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
      report.recommendations.push(buildRecommendation(f, 'Set up'));
    }

    const usedNames = featureNames(report.featuresUsed);
    if (usedNames.length === 0) {
      report.summary =
        'No customizations detected. Personalizing Copilot can significantly improve suggestion quality!';
    } else {
      report.summary = `Customization level: ${report.featuresUsed.length}/${total} — using ${usedNames.join(', ')}.`;
    }

    return report;
  }
}
