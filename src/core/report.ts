// Port of internal/report/markdown.go ExportMarkdown()

import { AnalysisResult } from '../core/analyzer';
import { allCategories, featuresByCategory, catalog } from '../core/featureCatalog';

/** Generate a markdown report string from an analysis result. */
export function generateMarkdownReport(r: AnalysisResult): string {
  const lines: string[] = [];

  lines.push('# Copilot Enabler — Adoption Report\n');
  lines.push(`*Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}*\n`);

  lines.push('## Scorecard\n');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Overall Adoption Score | **${r.overallScore}/100** |`);
  lines.push(`| Features Detected | ${r.usedFeatures} / ${r.totalFeatures} |`);
  lines.push(`| Log Entries Analyzed | ${r.logSummary.totalEntries} |\n`);

  lines.push('## Top Recommendations\n');
  for (let i = 0; i < r.topRecommendations.length; i++) {
    const rec = r.topRecommendations[i];
    lines.push(`### ${i + 1}. ${rec.stars} ${rec.title}\n`);
    lines.push(
      `**Impact:** ${rec.impact} | **Difficulty:** ${rec.difficulty} | **Category:** ${rec.category}\n`,
    );
    lines.push(`${rec.description}\n`);
    if (rec.actionItems.length > 0) {
      lines.push('**Steps:**');
      for (const step of rec.actionItems) {
        lines.push(`1. ${step}`);
      }
      lines.push('');
    }
    if (rec.docsURL) {
      lines.push(`[📖 Documentation](${rec.docsURL})\n`);
    }
  }

  lines.push('## Feature Adoption Matrix\n');
  const usedIDs = new Set<string>();
  for (const ar of r.agentReports) {
    for (const f of ar.featuresUsed) {
      usedIDs.add(f.id);
    }
  }
  const features = catalog();
  const byCat = featuresByCategory(features);
  for (const cat of allCategories) {
    const catFeatures = byCat.get(cat) ?? [];
    if (catFeatures.length === 0) {
      continue;
    }
    lines.push(`#### ${cat}\n`);
    lines.push('| Feature | Status |');
    lines.push('|---|---|');
    for (const f of catFeatures) {
      const status = usedIDs.has(f.id) ? '✅ Using' : '⬜ Not detected';
      lines.push(`| ${f.name} | ${status} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
