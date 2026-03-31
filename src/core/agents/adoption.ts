// Port of internal/agents/adoption.go

import { Agent, AgentReport, AnalysisContext } from './agent';
import { allCategories, featuresByCategory } from '../featureCatalog';
import { mergeHints, featureDetected, matrixScore, buildRecommendation } from './helpers';

/** AdoptionAgent compares the entire feature catalog against detected usage. */
export class AdoptionAgent implements Agent {
  name(): string {
    return 'Adoption';
  }

  description(): string {
    return 'Overall feature adoption & gap analysis';
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

    // Only score features that can actually be detected
    const detectableFeatures = ctx.featureCatalog.filter((f) => f.detectHints.length > 0);

    for (const f of detectableFeatures) {
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

    // Sort unused by matrix score descending (best quick wins first)
    report.featuresUnused.sort(
      (a, b) => matrixScore(b.impact, b.difficulty) - matrixScore(a.impact, a.difficulty),
    );

    const limit = Math.min(5, report.featuresUnused.length);
    for (let i = 0; i < limit; i++) {
      report.recommendations.push(buildRecommendation(report.featuresUnused[i], 'Discover'));
    }

    // Per-category summary (only detectable features)
    const byCat = featuresByCategory(detectableFeatures);
    const catSummaries: string[] = [];
    for (const cat of allCategories) {
      const catFeatures = byCat.get(cat) ?? [];
      let used = 0;
      for (const f of catFeatures) {
        if (featureDetected(f, allHints)) {
          used++;
        }
      }
      catSummaries.push(`${cat} ${used}/${catFeatures.length}`);
    }

    report.summary = `Overall adoption: ${report.featuresUsed.length}/${total} features (${report.score}%). Breakdown: ${catSummaries.join(' | ')}`;

    return report;
  }
}
