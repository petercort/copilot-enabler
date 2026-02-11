// Settings Panel — webview for configuring tracked features

import * as vscode from 'vscode';
import { catalog, allCategories, featuresByCategory, getHiddenFeatureIDs, Feature } from '../core/featureCatalog';

export class SettingsPanel {
  private static currentPanel: SettingsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;

    this.panel.onDidDispose(
      () => {
        SettingsPanel.currentPanel = undefined;
        for (const d of this.disposables) {
          d.dispose();
        }
      },
      null,
      this.disposables,
    );

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables,
    );
  }

  static show(): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel.panel.reveal(column);
      SettingsPanel.currentPanel.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'copilotEnablerSettings',
      'Copilot Enabler — Settings',
      column || vscode.ViewColumn.One,
      { enableScripts: true },
    );

    SettingsPanel.currentPanel = new SettingsPanel(panel);
    SettingsPanel.currentPanel.refresh();
  }

  private refresh(): void {
    this.panel.webview.html = this.getHtml();
  }

  private async handleMessage(msg: { type: string; featureId?: string; featureIds?: string[] }): Promise<void> {
    const config = vscode.workspace.getConfiguration('copilotEnabler');

    switch (msg.type) {
      case 'toggle': {
        if (!msg.featureId) { return; }
        const current = config.get<string[]>('hiddenFeatures', []);
        const idx = current.indexOf(msg.featureId);
        if (idx >= 0) {
          current.splice(idx, 1);
        } else {
          current.push(msg.featureId);
        }
        await config.update('hiddenFeatures', current, vscode.ConfigurationTarget.Global);
        this.refresh();
        break;
      }
      case 'hideAll': {
        if (!msg.featureIds) { return; }
        const current = config.get<string[]>('hiddenFeatures', []);
        const set = new Set(current);
        for (const id of msg.featureIds) { set.add(id); }
        await config.update('hiddenFeatures', Array.from(set), vscode.ConfigurationTarget.Global);
        this.refresh();
        break;
      }
      case 'showAll': {
        if (!msg.featureIds) { return; }
        const current = config.get<string[]>('hiddenFeatures', []);
        const toShow = new Set(msg.featureIds);
        await config.update('hiddenFeatures', current.filter((id) => !toShow.has(id)), vscode.ConfigurationTarget.Global);
        this.refresh();
        break;
      }
      case 'reset': {
        await config.update('hiddenFeatures', [], vscode.ConfigurationTarget.Global);
        this.refresh();
        break;
      }
    }
  }

  private getHtml(): string {
    const features = catalog();
    const hidden = getHiddenFeatureIDs();
    const byCat = featuresByCategory(features);

    const hiddenCount = hidden.size;
    const totalCount = features.length;
    const trackedCount = totalCount - hiddenCount;

    let categoriesHtml = '';
    for (const cat of allCategories) {
      const catFeatures = byCat.get(cat) ?? [];
      if (catFeatures.length === 0) { continue; }

      const catHidden = catFeatures.filter((f) => hidden.has(f.id)).length;
      const catTracked = catFeatures.length - catHidden;
      const catIds = JSON.stringify(catFeatures.map((f) => f.id));

      let rowsHtml = '';
      for (const f of catFeatures) {
        const isHidden = hidden.has(f.id);
        rowsHtml += `
          <tr class="${isHidden ? 'hidden-row' : ''}">
            <td>
              <label class="toggle-label">
                <input type="checkbox" ${isHidden ? '' : 'checked'}
                  onchange="toggle('${f.id}')" />
                <span class="toggle-slider"></span>
              </label>
            </td>
            <td>
              <strong>${escapeHtml(f.name)}</strong>
              <div class="feature-desc">${escapeHtml(f.description)}</div>
            </td>
            <td><span class="badge badge-${f.impact}">${f.impact}</span></td>
            <td><span class="badge badge-${f.difficulty}">${f.difficulty}</span></td>
            <td><a href="${f.docsURL}">Docs</a></td>
          </tr>`;
      }

      categoriesHtml += `
        <div class="category-section">
          <div class="category-header">
            <h3>${escapeHtml(cat)} <span class="count">${catTracked}/${catFeatures.length} tracked</span></h3>
            <div class="category-actions">
              <button onclick="showAllCategory(${escapeAttr(catIds)})">Track All</button>
              <button class="btn-secondary" onclick="hideAllCategory(${escapeAttr(catIds)})">Hide All</button>
            </div>
          </div>
          <table>
            <thead>
              <tr><th style="width:50px">Track</th><th>Feature</th><th>Impact</th><th>Difficulty</th><th>Docs</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Copilot Enabler — Settings</title>
  <style>
    body {
      font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
      color: var(--vscode-foreground, #cccccc);
      background: var(--vscode-editor-background, #1e1e1e);
      padding: 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 { border-bottom: 2px solid var(--vscode-panel-border, #444); padding-bottom: 8px; margin-bottom: 4px; }
    h3 { margin: 0; }
    .subtitle { opacity: 0.7; margin-bottom: 24px; font-size: 0.9em; }
    .summary-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding: 12px 16px;
      background: var(--vscode-editor-inactiveSelectionBackground, #264f78);
      border-radius: 8px;
    }
    .summary-bar .stat { font-size: 1.1em; }
    .summary-bar .stat strong { color: var(--vscode-textLink-foreground, #3794ff); }
    .summary-bar .spacer { flex: 1; }
    button {
      padding: 6px 14px;
      border: 1px solid var(--vscode-button-border, var(--vscode-panel-border, #555));
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
    }
    button:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    .btn-secondary {
      background: transparent;
      color: var(--vscode-foreground, #cccccc);
      border-color: var(--vscode-panel-border, #555);
    }
    .btn-secondary:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
    .btn-danger {
      background: transparent;
      color: #f48771;
      border-color: #f48771;
    }
    .btn-danger:hover { background: rgba(244, 135, 113, 0.1); }
    .category-section { margin-bottom: 28px; }
    .category-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .category-actions { display: flex; gap: 6px; }
    .count { font-size: 0.8em; opacity: 0.6; font-weight: normal; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--vscode-panel-border, #333); }
    th { opacity: 0.7; font-size: 0.85em; }
    .hidden-row { opacity: 0.45; }
    .feature-desc { font-size: 0.82em; opacity: 0.7; margin-top: 2px; }
    .badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: bold;
      text-transform: capitalize;
    }
    .badge-high { background: #d73a49; color: white; }
    .badge-medium { background: #e36209; color: white; }
    .badge-low { background: #28a745; color: white; }
    a { color: var(--vscode-textLink-foreground, #3794ff); }

    /* Toggle switch */
    .toggle-label {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 20px;
      cursor: pointer;
    }
    .toggle-label input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute;
      inset: 0;
      background: var(--vscode-panel-border, #555);
      border-radius: 20px;
      transition: 0.2s;
    }
    .toggle-slider::before {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.2s;
    }
    .toggle-label input:checked + .toggle-slider {
      background: var(--vscode-textLink-foreground, #3794ff);
    }
    .toggle-label input:checked + .toggle-slider::before {
      transform: translateX(16px);
    }
  </style>
</head>
<body>
  <h1>Copilot Enabler — Settings</h1>
  <p class="subtitle">Choose which Copilot features to track. Hidden features are excluded from your adoption score, recommendations, and reports.</p>

  <div class="summary-bar">
    <span class="stat"><strong>${trackedCount}</strong> / ${totalCount} features tracked</span>
    <span class="spacer"></span>
    ${hiddenCount > 0 ? `<button class="btn-danger" onclick="resetAll()">Reset All (unhide ${hiddenCount})</button>` : ''}
  </div>

  ${categoriesHtml}

  <script>
    const vscode = acquireVsCodeApi();

    function toggle(featureId) {
      vscode.postMessage({ type: 'toggle', featureId });
    }

    function hideAllCategory(featureIds) {
      vscode.postMessage({ type: 'hideAll', featureIds });
    }

    function showAllCategory(featureIds) {
      vscode.postMessage({ type: 'showAll', featureIds });
    }

    function resetAll() {
      vscode.postMessage({ type: 'reset' });
    }
  </script>
</body>
</html>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(json: string): string {
  return json.replace(/'/g, '&#39;').replace(/"/g, '&apos;');
}
