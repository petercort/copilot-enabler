// Webview Dashboard Panel — port of report/terminal.go PrintDashboard()

import * as vscode from 'vscode';
import { AnalysisResult } from '../core/analyzer';
import { allCategories, Feature, featuresByCategory, visibleCatalog } from '../core/featureCatalog';
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
    const impl = implementableFeatures();
    const recsHtml = result.topRecommendations
      .map(
        (rec, i) => {
          return `
        <tr>
          <td>${i + 1}.</td>
          <td>${escapeHtml(rec.title)}</td>
          <td><span class="badge badge-${rec.impact}">${rec.impact}</span></td>
          <td>${buildLinksCell(rec.featureID, rec.docsURL, impl)}</td>
        </tr>`;
        },
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
    .links-cell { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .links-cell a { white-space: nowrap; }
    .info-icon {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 1px solid var(--vscode-textLink-foreground, #3794ff);
      color: var(--vscode-textLink-foreground, #3794ff);
      font-size: 11px;
      font-weight: bold;
      font-style: italic;
      margin-left: 6px;
      vertical-align: middle;
      line-height: 1;
      opacity: 0.8;
      transition: opacity 0.15s;
    }
    .info-icon:hover { opacity: 1; }
    .info-popup-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4);
      z-index: 999;
      align-items: center;
      justify-content: center;
    }
    .info-popup-overlay.visible { display: flex; }
    .info-popup {
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-panel-border, #444);
      border-radius: 8px;
      padding: 20px 24px;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    }
    .info-popup h3 {
      margin-top: 0;
      color: var(--vscode-textLink-foreground, #3794ff);
      font-size: 1.1em;
    }
    .info-popup p { margin: 8px 0; line-height: 1.5; }
    .info-popup .shortcuts-label {
      font-weight: bold;
      margin-top: 12px;
      margin-bottom: 4px;
      font-size: 0.9em;
      opacity: 0.8;
    }
    .info-popup ul {
      margin: 4px 0 0 0;
      padding-left: 18px;
    }
    .info-popup li { margin: 4px 0; line-height: 1.4; font-size: 0.9em; }
    .info-popup .close-btn {
      margin-top: 16px;
      padding: 4px 14px;
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
    }
    .info-popup .close-btn:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
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
      <tr><th>#</th><th>Recommendation</th><th>Impact</th><th>Links</th></tr>
    </thead>
    <tbody>${recsHtml}</tbody>
  </table>

  <h2>Feature Adoption Matrix</h2>
  ${matrixHtml}

  <div class="info-popup-overlay" id="infoOverlay">
    <div class="info-popup">
      <h3 id="infoTitle"></h3>
      <p id="infoDesc"></p>
      <div id="infoShortcuts"></div>
      <button class="close-btn" id="infoClose">Close</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-implement]');
      if (link) {
        e.preventDefault();
        vscode.postMessage({ command: 'implement', featureID: link.dataset.implement });
      }
      const infoBtn = e.target.closest('.info-icon');
      if (infoBtn) {
        e.preventDefault();
        document.getElementById('infoTitle').textContent = infoBtn.dataset.name;
        document.getElementById('infoDesc').textContent = infoBtn.dataset.desc;
        const stepsEl = document.getElementById('infoShortcuts');
        const steps = JSON.parse(infoBtn.dataset.steps || '[]');
        if (steps.length > 0) {
          stepsEl.innerHTML = '<div class="shortcuts-label">Setup &amp; Shortcuts</div><ul>' +
            steps.map(s => '<li>' + s + '</li>').join('') + '</ul>';
        } else {
          stepsEl.innerHTML = '';
        }
        document.getElementById('infoOverlay').classList.add('visible');
      }
    });
    document.getElementById('infoClose').addEventListener('click', () => {
      document.getElementById('infoOverlay').classList.remove('visible');
    });
    document.getElementById('infoOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('infoOverlay').classList.remove('visible');
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
      html += '<table><thead><tr><th>Feature</th><th>Status</th><th>Links</th></tr></thead><tbody>';
      const impl = implementableFeatures();
      for (const f of catFeatures) {
        const isUsed = usedIDs.has(f.id);
        const status = isUsed ? '✅ Using' : '⬜ Not detected';
        const infoIcon = buildInfoIcon(f);
        html += `<tr><td>${escapeHtml(f.name)}${infoIcon}</td><td>${status}</td><td>${buildLinksCell(f.id, f.docsURL, impl)}</td></tr>`;
      }
      html += '</tbody></table>';
    }

    return html;
  }
}

function buildLinksCell(featureID: string, docsURL: string, impl: Set<string>, tutorialURL?: string): string {
  const links: string[] = [];
  if (docsURL) {
    links.push(`<a href="${docsURL}" title="Documentation">📖 Docs</a>`);
  }
  if (tutorialURL) {
    links.push(`<a href="${tutorialURL}" title="Tutorial">🎓 Tutorial</a>`);
  }
  if (impl.has(featureID)) {
    links.push(`<a class="setup-link" data-implement="${featureID}" title="Let Copilot help you set this up">▶ Set up</a>`);
  }
  return links.length > 0 ? `<span class="links-cell">${links.join(' ')}</span>` : '';
}

function buildInfoIcon(f: Feature): string {
  const desc = escapeHtml(f.description);
  const steps = JSON.stringify(f.setupSteps.map(s => escapeHtml(s)));
  return ` <span class="info-icon" data-name="${escapeHtml(f.name)}" data-desc="${desc}" data-steps='${steps}' title="More info">i</span>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
