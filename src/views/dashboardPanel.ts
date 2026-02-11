// Webview Dashboard Panel — port of report/terminal.go PrintDashboard()

import * as vscode from 'vscode';
import { AnalysisResult } from '../core/analyzer';
import { allCategories, featuresByCategory, visibleCatalog } from '../core/featureCatalog';
import { implementableFeatures } from '../core/prompts';

export class DashboardPanel {
  private static currentPanel: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;

    this.panel.onDidDispose(
      () => {
        DashboardPanel.currentPanel = undefined;
        for (const d of this.disposables) {
          d.dispose();
        }
      },
      null,
      this.disposables,
    );

    this.panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.command === 'implement') {
          vscode.commands.executeCommand('copilotEnabler.implement', { featureID: message.featureID });
        }
      },
      null,
      this.disposables,
    );
  }

  static show(extensionUri: vscode.Uri, result: AnalysisResult): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      DashboardPanel.currentPanel.update(result);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'copilotEnablerDashboard',
      'Copilot Enabler — Scorecard',
      column || vscode.ViewColumn.One,
      { enableScripts: true },
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
    DashboardPanel.currentPanel.update(result);
  }

  private update(result: AnalysisResult): void {
    this.panel.webview.html = this.getHtml(result);
  }

  private getHtml(result: AnalysisResult): string {
    const recsHtml = result.topRecommendations
      .map(
        (rec, i) => `
        <tr>
          <td>${i + 1}.</td>
          <td>${rec.stars}</td>
          <td>${escapeHtml(rec.title)}</td>
          <td><span class="badge badge-${rec.impact}">${rec.impact}</span></td>
          <td><span class="badge badge-${rec.difficulty}">${rec.difficulty}</span></td>
          <td><a href="${rec.docsURL}">Docs</a></td>
        </tr>`,
      )
      .join('');

    const matrixHtml = this.featureMatrix(result);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Copilot Enabler — Scorecard</title>
  <style>
    body {
      font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
      color: var(--vscode-foreground, #cccccc);
      background: var(--vscode-editor-background, #1e1e1e);
      padding: 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 { border-bottom: 2px solid var(--vscode-panel-border, #444); padding-bottom: 8px; }
    h2 { margin-top: 32px; color: var(--vscode-textLink-foreground, #3794ff); }
    h3 { margin-top: 24px; }
    .scorecard {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin: 20px 0;
    }
    .score-card {
      background: var(--vscode-editor-inactiveSelectionBackground, #264f78);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .score-card .value {
      font-size: 2em;
      font-weight: bold;
      color: var(--vscode-textLink-foreground, #3794ff);
    }
    .score-card .label { font-size: 0.85em; opacity: 0.8; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border, #333); }
    th { opacity: 0.7; font-size: 0.85em; }
    .badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: bold;
    }
    .badge-high { background: #d73a49; color: white; }
    .badge-medium { background: #e36209; color: white; }
    .badge-low { background: #28a745; color: white; }
    .progress-bar {
      background: var(--vscode-editor-inactiveSelectionBackground, #264f78);
      border-radius: 4px;
      height: 20px;
      overflow: hidden;
      margin: 4px 0;
    }
    .progress-fill {
      height: 100%;
      border-radius: 4px;
      background: var(--vscode-textLink-foreground, #3794ff);
      transition: width 0.3s;
    }
    a { color: var(--vscode-textLink-foreground, #3794ff); }
    .feature-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 4px; }
    .feature-item { padding: 2px 0; }
    .feature-used { color: #28a745; }
    .feature-unused { opacity: 0.6; }
    .setup-link {
      cursor: pointer;
      color: var(--vscode-textLink-foreground, #3794ff);
      text-decoration: none;
      font-size: 0.85em;
      margin-left: 6px;
    }
    .setup-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Copilot Enabler — Scorecard</h1>

  <div class="scorecard">
    <div class="score-card">
      <div class="value">${result.overallScore}/100</div>
      <div class="label">Adoption Score</div>
    </div>
    <div class="score-card">
      <div class="value">${result.usedFeatures} / ${result.totalFeatures}</div>
      <div class="label">Features Detected</div>
    </div>
    <div class="score-card">
      <div class="value">${result.logSummary.totalEntries}</div>
      <div class="label">Log Entries Analyzed</div>
    </div>
  </div>

  <h2>🔥 Top Recommendations</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Rating</th><th>Recommendation</th><th>Impact</th><th>Difficulty</th><th>Docs</th></tr>
    </thead>
    <tbody>${recsHtml}</tbody>
  </table>

  <h2>Feature Adoption Matrix</h2>
  ${matrixHtml}

  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-implement]');
      if (link) {
        e.preventDefault();
        vscode.postMessage({ command: 'implement', featureID: link.dataset.implement });
      }
    });
  </script>
</body>
</html>`;
  }

  private featureMatrix(result: AnalysisResult): string {
    const usedIDs = new Set<string>();
    for (const ar of result.agentReports) {
      for (const f of ar.featuresUsed) {
        usedIDs.add(f.id);
      }
    }

    const features = visibleCatalog();
    const byCat = featuresByCategory(features);
    let html = '';

    for (const cat of allCategories) {
      const catFeatures = byCat.get(cat) ?? [];
      if (catFeatures.length === 0) { continue; }
      const used = catFeatures.filter((f) => usedIDs.has(f.id)).length;
      const pct = Math.floor((used / catFeatures.length) * 100);

      html += `<h3>${escapeHtml(cat)} <small>${used}/${catFeatures.length}</small></h3>`;
      html += `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
      html += '<table><thead><tr><th>Feature</th><th>Status</th></tr></thead><tbody>';
      const impl = implementableFeatures();
      for (const f of catFeatures) {
        const isUsed = usedIDs.has(f.id);
        const canSetup = !isUsed && impl.has(f.id);
        const status = isUsed ? '✅ Using' : '⬜ Not detected';
        const setupLink = canSetup
          ? ` <a class="setup-link" data-implement="${f.id}" title="Let Copilot help you set this up">▶ Set up</a>`
          : '';
        html += `<tr><td>${escapeHtml(f.name)}</td><td>${status}${setupLink}</td></tr>`;
      }
      html += '</tbody></table>';
    }

    return html;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
