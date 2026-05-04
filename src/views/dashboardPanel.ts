// Webview Dashboard Panel — port of report/terminal.go PrintDashboard()

import * as vscode from 'vscode';
import { AnalysisResult } from '../core/analyzer';
import { allCategories, Feature, featuresByCategory, visibleCatalog, getFeatureAvailability } from '../core/featureCatalog';
import { implementableFeatures, tutorialPrompts } from '../core/prompts';
import { StaticFinding } from '../core/promptimizer/types';

export class DashboardPanel {
  private static currentPanel: DashboardPanel | undefined;
  private static lastResult: AnalysisResult | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, _extensionUri: vscode.Uri) {
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
        } else if (message.command === 'showMe') {
          vscode.commands.executeCommand('copilotEnabler.showMe', { featureID: message.featureID });
        } else if (message.command === 'openFile') {
          const uri = vscode.Uri.file(message.filePath);
          vscode.window.showTextDocument(uri, { preview: false }).then(undefined, () => {
            vscode.window.showWarningMessage(`Could not open file: ${message.filePath}`);
          });
        } else if (message.command === 'implementOptimization') {
          vscode.commands.executeCommand('copilotEnabler.implement', { featureID: 'custom-prompt-optimization' });
        } else if (message.command === 'shareLinkedIn') {
          const text = DashboardPanel.buildShareText(DashboardPanel.lastResult);
          vscode.env.clipboard.writeText(text).then(() => {
            vscode.env.openExternal(vscode.Uri.parse('https://www.linkedin.com/feed/?shareActive=true'));
          });
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
    DashboardPanel.lastResult = result;
    this.panel.webview.html = this.getHtml(result);
  }

  private getHtml(result: AnalysisResult): string {
    const impl = implementableFeatures();
    const tutorials = new Set(Object.keys(tutorialPrompts));
    const recsHtml = result.topRecommendations
      .map(
        (rec, i) => {
          return `
        <tr>
          <td>${i + 1}.</td>
          <td>${escapeHtml(rec.title)}</td>
          <td><span class="badge badge-${rec.impact}">${rec.impact}</span></td>
          <td>${buildLinksCell(rec.featureID, rec.docsURL, impl, tutorials)}</td>
        </tr>`;
        },
      )
      .join('');

    const matrixHtml = this.featureMatrix(result);
    const optimizationHtml = buildOptimizationSection(result.staticFindings ?? []);

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
    .score-card-note { font-size: 0.75em; opacity: 0.7; margin-top: 6px; color: var(--vscode-editorWarning-foreground, #cca700); cursor: default; }
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
    .tutorial-link {
      cursor: pointer;
      color: var(--vscode-textLink-foreground, #3794ff);
      text-decoration: none;
      font-size: 0.85em;
      margin-left: 6px;
    }
    .tutorial-link:hover { text-decoration: underline; }
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
    .share-bar { margin: 20px 0; display: flex; gap: 10px; align-items: center; }
    .share-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
      font-weight: 600;
      background: #0a66c2;
      color: #fff;
    }
    .share-btn:hover { background: #004182; }
    .share-copied { font-size: 0.85em; opacity: 0.8; display: none; }
    /* ── Optimization To-Dos ── */
    .opt-section { margin-top: 32px; }
    .opt-empty { opacity: 0.6; font-style: italic; margin: 12px 0; }
    .opt-summary { font-size: 0.85em; opacity: 0.7; margin-bottom: 16px; }
    .opt-todo-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
    .opt-todo {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 6px;
      border: 1px solid var(--vscode-panel-border, #333);
      background: var(--vscode-editor-inactiveSelectionBackground, #1a1a2e);
      transition: opacity 0.2s;
    }
    .opt-todo.done { opacity: 0.4; }
    .opt-todo.done .opt-todo-msg { text-decoration: line-through; }
    .opt-todo-check {
      margin-top: 2px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      cursor: pointer;
      accent-color: var(--vscode-textLink-foreground, #3794ff);
    }
    .opt-todo-body { flex: 1; min-width: 0; }
    .opt-todo-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
    .opt-rule-badge {
      font-size: 0.72em;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 3px;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    .opt-rule-authoring { background: #1c4a7a; color: #7ec8e3; }
    .opt-rule-hygiene   { background: #3a2a00; color: #f0c040; }
    .opt-rule-compression { background: #2a1a3a; color: #c586c0; }
    .opt-risk-high   { color: #f14c4c; font-size: 0.78em; font-weight: 600; }
    .opt-risk-medium { color: #e36209; font-size: 0.78em; font-weight: 600; }
    .opt-risk-low    { color: #4ec9b0; font-size: 0.78em; font-weight: 600; }
    .opt-risk-none   { color: #888;    font-size: 0.78em; }
    .opt-todo-msg { font-size: 0.88em; line-height: 1.5; }
    .opt-todo-file {
      font-size: 0.76em;
      opacity: 0.55;
      margin-top: 4px;
      word-break: break-all;
    }
    .opt-todo-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .opt-action-btn {
      font-size: 0.78em;
      padding: 2px 10px;
      border: 1px solid var(--vscode-textLink-foreground, #3794ff);
      border-radius: 3px;
      background: transparent;
      color: var(--vscode-textLink-foreground, #3794ff);
      cursor: pointer;
      white-space: nowrap;
    }
    .opt-action-btn:hover { background: rgba(55,148,255,0.12); }
    .opt-fix-all-btn {
      font-size: 0.82em;
      padding: 4px 14px;
      border: none;
      border-radius: 4px;
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      cursor: pointer;
      margin-bottom: 14px;
    }
    .opt-fix-all-btn:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    /* ── Version badges ── */
    .badge { display: inline-block; font-size: 0.72em; font-weight: 700; padding: 1px 7px; border-radius: 3px; letter-spacing: 0.03em; white-space: nowrap; vertical-align: middle; margin-left: 6px; }
    .badge-new { background: #1a3a1a; color: #4ec9b0; }
    .badge-locked { background: #3a2a00; color: #f0c040; }
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
    <div class="score-card">
      <div class="value">${result.logSummary.llmRequests > 0
        ? `${result.logSummary.totalInputTokens.toLocaleString()} / ${result.logSummary.totalOutputTokens.toLocaleString()}`
        : '—'}</div>
      <div class="label">Input / Output Tokens</div>
      ${result.logSummary.hasVSCodeLogs
        ? `<div class="score-card-note" title="Enable debug output logging to capture per-call token data">⚠ Cache token data unavailable for VS Code log entries</div>`
        : ''}
    </div>
  </div>

  <div class="share-bar">
    <button class="share-btn" id="shareLinkedIn">🔗 Share to LinkedIn</button>
    <span class="share-copied" id="shareCopied">Summary copied to clipboard!</span>
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

  ${optimizationHtml}

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
    document.getElementById('shareLinkedIn').addEventListener('click', () => {
      vscode.postMessage({ command: 'shareLinkedIn' });
      const badge = document.getElementById('shareCopied');
      badge.style.display = 'inline';
      setTimeout(() => { badge.style.display = 'none'; }, 3000);
    });
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-implement]');
      if (link) {
        e.preventDefault();
        vscode.postMessage({ command: 'implement', featureID: link.dataset.implement });
      }
      const showMeLink = e.target.closest('[data-show-me]');
      if (showMeLink) {
        e.preventDefault();
        vscode.postMessage({ command: 'showMe', featureID: showMeLink.dataset.showMe });
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
      const openFileBtn = e.target.closest('[data-open-file]');
      if (openFileBtn) {
        e.preventDefault();
        vscode.postMessage({ command: 'openFile', filePath: openFileBtn.dataset.openFile });
      }
      const fixAllBtn = e.target.closest('#optFixAllBtn');
      if (fixAllBtn) {
        e.preventDefault();
        vscode.postMessage({ command: 'implementOptimization' });
      }
    });
    // Optimization to-do checkboxes
    document.addEventListener('change', (e) => {
      const cb = e.target.closest('.opt-todo-check');
      if (!cb) { return; }
      const todo = cb.closest('.opt-todo');
      if (todo) { todo.classList.toggle('done', cb.checked); }
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
    const impl = implementableFeatures();
    const tutorials = new Set(Object.keys(tutorialPrompts));

    for (const cat of allCategories) {
      const catFeatures = byCat.get(cat) ?? [];
      if (catFeatures.length === 0) { continue; }
      // Exclude unavailable from ratio/progress calculation
      const available = catFeatures.filter((f) => getFeatureAvailability(f) !== 'unavailable');
      const detectable = available.filter((f) => f.detectHints.length > 0);
      const notDetectable = available.filter((f) => f.detectHints.length === 0);
      const unavailableFeatures = catFeatures.filter((f) => getFeatureAvailability(f) === 'unavailable');
      const used = detectable.filter((f) => usedIDs.has(f.id)).length;
      const pct = detectable.length > 0 ? Math.floor((used / detectable.length) * 100) : 0;

      html += `<h3>${escapeHtml(cat)} <small>${used}/${detectable.length}</small></h3>`;
      html += `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
      html += '<table><thead><tr><th>Feature</th><th>Status</th><th>Links</th></tr></thead><tbody>';
      for (const f of detectable) {
        const isUsed = usedIDs.has(f.id);
        const availability = getFeatureAvailability(f);
        const badge = availability === 'new' ? '<span class="badge badge-new">New</span>' : '';
        const status = isUsed ? `✅ Using${badge}` : `⬜ Not detected${badge}`;
        const infoIcon = buildInfoIcon(f);
        html += `<tr><td>${escapeHtml(f.name)}${infoIcon}</td><td>${status}</td><td>${buildLinksCell(f.id, f.docsURL, impl, tutorials)}</td></tr>`;
      }
      for (const f of notDetectable) {
        const availability = getFeatureAvailability(f);
        const badge = availability === 'new' ? '<span class="badge badge-new">New</span>' : '';
        const infoIcon = buildInfoIcon(f);
        html += `<tr><td>${escapeHtml(f.name)}${infoIcon}${badge}</td><td></td><td>${buildLinksCell(f.id, f.docsURL, impl, tutorials)}</td></tr>`;
      }
      for (const f of unavailableFeatures) {
        const infoIcon = buildInfoIcon(f);
        const badge = `<span class="badge badge-locked">Requires v${escapeHtml(f.addedIn)}+</span>`;
        html += `<tr><td>${escapeHtml(f.name)}${infoIcon}${badge}</td><td></td><td><a href="${escapeHtml(f.docsURL)}" target="_blank">Docs</a></td></tr>`;
      }
      html += '</tbody></table>';
    }

    return html;
  }

  static buildShareText(result: AnalysisResult | undefined): string {
    if (!result) {
      return 'I just analyzed my GitHub Copilot setup with Copilot Enabler for VS Code!';
    }
    const lines = [
      `I just scored ${result.overallScore}/100 on my GitHub Copilot adoption scorecard! 🚀`,
      '',
      `📊 ${result.usedFeatures}/${result.totalFeatures} features detected`,
    ];
    if (result.topRecommendations.length > 0) {
      lines.push('');
      lines.push('Top recommendations:');
      for (const rec of result.topRecommendations.slice(0, 3)) {
        lines.push(`• ${rec.title}`);
      }
    }
    lines.push('');
    lines.push('Check your own score with the Copilot Enabler extension for VS Code.');
    lines.push('#GitHubCopilot #DeveloperProductivity #AI');
    return lines.join('\n');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Optimization section builder
// ──────────────────────────────────────────────────────────────────────────────

const RULE_LABELS: Record<string, string> = {
  'S-AOC1': 'Always-On Budget',
  'S-ASC1': 'Missing applyTo Scope',
  'S-RP1':  'Broad Retrieval',
  'S-PCS1': 'Cache Stability',
  'S-FP1':  'Performative Fluff',
  'S-RB1':  'Rule Bloat',
  'S-FS1':  'Few-Shot Overload',
  'S-DED1': 'Duplicate Content',
};

function buildOptimizationSection(findings: StaticFinding[]): string {
  const highCount  = findings.filter((f) => f.quality_risk === 'high').length;
  const medCount   = findings.filter((f) => f.quality_risk === 'medium').length;

  const summaryParts: string[] = [];
  if (highCount > 0)  { summaryParts.push(`<span class="opt-risk-high">${highCount} high</span>`); }
  if (medCount > 0)   { summaryParts.push(`<span class="opt-risk-medium">${medCount} medium</span>`); }
  const lowCount = findings.length - highCount - medCount;
  if (lowCount > 0)   { summaryParts.push(`<span class="opt-risk-low">${lowCount} low</span>`); }

  const emptyMsg = findings.length === 0
    ? '<p class="opt-empty">No optimization findings — your instruction files look well-architected! 🎉</p>'
    : '';

  const fixAllBtn = findings.length > 0
    ? `<button class="opt-fix-all-btn" id="optFixAllBtn">▶ Fix with Copilot</button>`
    : '';

  const todosHtml = findings
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2, none: 3 };
      return (order[a.quality_risk] ?? 3) - (order[b.quality_risk] ?? 3);
    })
    .map((f, idx) => {
      const id = `opt-todo-${idx}`;
      const catClass = `opt-rule-${f.category}`;
      const riskClass = `opt-risk-${f.quality_risk}`;
      const riskLabel = f.quality_risk === 'none' ? '' : f.quality_risk.toUpperCase();
      const ruleLabel = RULE_LABELS[f.rule] ?? f.rule;
      const shortFile = f.file.replace(/\\/g, '/').split('/').slice(-3).join('/');

      const actions: string[] = [];
      actions.push(`<button class="opt-action-btn" data-open-file="${escapeHtml(f.file)}">📂 Open file</button>`);

      return `
      <li class="opt-todo" id="${id}">
        <input class="opt-todo-check" type="checkbox" id="${id}-cb" aria-label="Mark as done">
        <div class="opt-todo-body">
          <div class="opt-todo-header">
            <span class="opt-rule-badge ${catClass}">${escapeHtml(f.rule)}</span>
            <span>${escapeHtml(ruleLabel)}</span>
            ${riskLabel ? `<span class="${riskClass}">${riskLabel}</span>` : ''}
          </div>
          <div class="opt-todo-msg">${escapeHtml(f.message)}</div>
          <div class="opt-todo-file" title="${escapeHtml(f.file)}">📄 …/${escapeHtml(shortFile)}${f.line ? `:${f.line}` : ''}</div>
          <div class="opt-todo-actions">${actions.join('')}</div>
        </div>
      </li>`;
    })
    .join('');

  return `
  <div class="opt-section">
    <h2>🛠 Optimization To-Dos</h2>
    <p class="opt-summary">
      ${findings.length > 0
        ? `${findings.length} finding${findings.length !== 1 ? 's' : ''} — ${summaryParts.join(', ')} — from Well-Architected token rules on your instruction files.`
        : 'Well-Architected token rules scanned your instruction files.'}
    </p>
    ${fixAllBtn}
    ${emptyMsg}
    <ul class="opt-todo-list">${todosHtml}</ul>
  </div>`;
}

function buildLinksCell(featureID: string, docsURL: string, impl: Set<string>, tutorials?: Set<string>): string {  const links: string[] = [];
  if (docsURL) {
    links.push(`<a href="${docsURL}" title="Documentation">📖 Docs</a>`);
  }
  if (tutorials && tutorials.has(featureID)) {
    links.push(`<a class="tutorial-link" data-show-me="${featureID}" title="Interactive tutorial tailored to your workspace">🎓 Show me</a>`);
  }
  if (impl.has(featureID)) {
    links.push(`<a class="setup-link" data-implement="${featureID}" title="Let Copilot help you set this up">▶ Set up</a>`);
  }
  return links.length > 0 ? `<span class="links-cell">${links.join(' ')}</span>` : '';
}

function buildInfoIcon(f: Feature): string {
  const desc = escapeHtml(f.description);
  const steps = escapeHtml(JSON.stringify(f.setupSteps));
  return ` <span class="info-icon" data-name="${escapeHtml(f.name)}" data-desc="${desc}" data-steps="${steps}" title="More info">i</span>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
