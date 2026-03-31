// Extension entry point — replaces cmd/copilot-analyzer/main.go + cli/cli.go

import * as vscode from 'vscode';
import { runAnalysis, AnalysisResult } from './core/analyzer';
import { scanSettings } from './core/scanner/settings';
import { scanWorkspace } from './core/scanner/workspace';
import { scanExtensions } from './core/scanner/extensions';
import { scanCopilotLogs } from './core/scanner/logs';
import { catalog, getHiddenFeatureIDs } from './core/featureCatalog';
import { implementableFeatures, systemPrompts, tutorialPrompts } from './core/prompts';
import { FeatureTreeProvider, FeatureItem } from './views/featureTreeProvider';
import { RecommendationTreeProvider } from './views/recommendationTree';
import { StatusBarManager } from './views/statusBar';
import { DashboardPanel } from './views/dashboardPanel';
import { SettingsPanel } from './views/settingsPanel';
import { Recommendation, buildRecommendation } from './core/agents';

let statusBar: StatusBarManager;
let featureTree: FeatureTreeProvider;
let recommendationTree: RecommendationTreeProvider;
let lastResult: AnalysisResult | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // --- Status Bar ---
  statusBar = new StatusBarManager();
  context.subscriptions.push({ dispose: () => statusBar.dispose() });

  // --- Tree Views ---
  featureTree = new FeatureTreeProvider();
  recommendationTree = new RecommendationTreeProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('copilotEnabler.features', featureTree),
    vscode.window.registerTreeDataProvider('copilotEnabler.recommendations', recommendationTree),
  );

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('copilotEnabler.analyze', () => handleAnalyze(context)),
    vscode.commands.registerCommand('copilotEnabler.featureMatrix', () => handleFeatureMatrix(context)),
    vscode.commands.registerCommand('copilotEnabler.featureCatalog', () => handleFeatureCatalog()),
    vscode.commands.registerCommand('copilotEnabler.implement', (rec?: Recommendation) => handleImplement(rec)),
    vscode.commands.registerCommand('copilotEnabler.showMe', (rec?: Recommendation) => handleShowMe(rec)),
    vscode.commands.registerCommand('copilotEnabler.refresh', () => handleAnalyze(context)),
    vscode.commands.registerCommand('copilotEnabler.hideFeature', (item?: FeatureItem) => handleHideFeature(context, item)),
    vscode.commands.registerCommand('copilotEnabler.unhideFeature', () => handleUnhideFeature(context)),
    vscode.commands.registerCommand('copilotEnabler.resetHiddenFeatures', () => handleResetHiddenFeatures(context)),
    vscode.commands.registerCommand('copilotEnabler.settings', () => SettingsPanel.show()),
  );

  // --- File Watchers ---
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/{.github/copilot-instructions.md,.copilotignore,.vscode/mcp.json,mcp.json,.github/prompts/*.prompt.md}',
  );
  watcher.onDidCreate(() => handleAnalyze(context, true));
  watcher.onDidDelete(() => handleAnalyze(context, true));
  context.subscriptions.push(watcher);

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (
      e.affectsConfiguration('github.copilot') ||
      e.affectsConfiguration('editor.inlineSuggest') ||
      e.affectsConfiguration('copilotEnabler.hiddenFeatures')
    ) {
      handleAnalyze(context, true);
    }
  }, null, context.subscriptions);

  vscode.extensions.onDidChange(() => {
    handleAnalyze(context, true);
  }, null, context.subscriptions);

  // --- Initial scan on activation ---
  handleAnalyze(context, true);
}

export function deactivate(): void {
  // Cleanup handled by disposables
}

// ─── Command Handlers ───

async function collectData() {
  const logEntries = scanCopilotLogs();
  const settings = scanSettings();
  const workspace = await scanWorkspace();
  const extensions = scanExtensions();
  return { logEntries, settings, workspace, extensions };
}

async function handleAnalyze(
  context: vscode.ExtensionContext,
  silent = false,
): Promise<void> {
  if (!silent) {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Copilot Enabler: Analyzing...' },
      async () => {
        await doAnalysis(context, false);
      },
    );
  } else {
    await doAnalysis(context, true);
  }
}

async function doAnalysis(context: vscode.ExtensionContext, silent = false): Promise<void> {
  try {
    const { logEntries, settings, workspace, extensions } = await collectData();
    const result = runAnalysis(logEntries, settings, workspace, extensions);
    lastResult = result;

    // Update status bar
    statusBar.update(result.overallScore, result.usedFeatures, result.totalFeatures);

    // Update tree views
    const usedIDs = new Set<string>();
    for (const ar of result.agentReports) {
      for (const f of ar.featuresUsed) {
        usedIDs.add(f.id);
      }
    }
    featureTree.refresh(usedIDs);
    recommendationTree.refresh(result.topRecommendations);

    // Only show dashboard webview when explicitly requested
    if (!silent) {
      DashboardPanel.show(context.extensionUri, result);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Copilot Enabler: analysis failed', err);
    if (!silent) {
      vscode.window.showErrorMessage(`Copilot Enabler: analysis failed — ${msg}`);
    }
  }
}

async function handleFeatureMatrix(context: vscode.ExtensionContext): Promise<void> {
  if (!lastResult) {
    await handleAnalyze(context);
  }
  // Dashboard already shows the matrix — just ensure it's visible
  if (lastResult) {
    DashboardPanel.show(context.extensionUri, lastResult);
  }
}

function handleFeatureCatalog(): void {
  // Focus the feature catalog tree view
  vscode.commands.executeCommand('copilotEnabler.features.focus');
}

async function handleImplement(arg?: Recommendation | { recommendation: Recommendation } | { featureID: string }): Promise<void> {
  // When invoked from a tree view context menu, VS Code passes the TreeItem
  // (RecommendationItem) which wraps the Recommendation in a .recommendation property.
  // When invoked from the dashboard webview, we receive { featureID }.
  let rec: Recommendation | undefined;
  if (arg && 'recommendation' in arg) {
    rec = arg.recommendation;
  } else if (arg && 'featureID' in arg && !('matrixScore' in arg)) {
    // From dashboard webview — look up the feature and build a minimal rec
    const feature = catalog().find((f) => f.id === arg.featureID);
    if (feature) {
      rec = buildRecommendation(feature, 'Set up');
    }
  } else {
    rec = arg as Recommendation | undefined;
  }

  if (!rec) {
    // No recommendation passed — let user pick one
    if (!lastResult) {
      vscode.window.showWarningMessage('Run a full analysis first.');
      return;
    }

    const impl = implementableFeatures();
    const implementable = lastResult.topRecommendations.filter((r) => impl.has(r.featureID));

    // Also check agent reports for more implementable recs
    if (implementable.length === 0) {
      for (const ar of lastResult.agentReports) {
        for (const r of ar.recommendations) {
          if (impl.has(r.featureID) && !implementable.find((i) => i.featureID === r.featureID)) {
            implementable.push(r);
          }
        }
      }
    }

    if (implementable.length === 0) {
      vscode.window.showInformationMessage('No implementable recommendations found.');
      return;
    }

    const items = implementable.map((r) => ({
      label: `${r.stars} ${r.title}`,
      description: r.description,
      recommendation: r,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a recommendation to implement with Copilot',
    });

    if (!picked) {
      return;
    }

    rec = picked.recommendation;
  }

  // At this point, rec is guaranteed to be defined
  const featureID = rec.featureID;
  const title = rec.title;

  // Get the system prompt for this feature
  const prompt = systemPrompts[featureID];
  if (!prompt) {
    vscode.window.showErrorMessage(`No interactive implementation available for: ${title}`);
    return;
  }

  // Open Copilot Chat with pre-filled message
  const message = `I want to set up ${title} for my project. Here's the context:\n\n${prompt}\n\nPlease start by reading my project context and then guide me through it.`;

  // Try to send to Copilot Chat via command
  try {
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: message,
    });
  } catch {
    // Fallback: copy prompt to clipboard
    await vscode.env.clipboard.writeText(message);
    vscode.window.showInformationMessage(
      `Prompt copied to clipboard. Open Copilot Chat and paste it to get started with setting up ${title}.`,
    );
  }
}

async function handleShowMe(arg?: Recommendation | { recommendation: Recommendation } | { featureID: string }): Promise<void> {
  // When invoked from a tree view context menu, VS Code passes the TreeItem
  // (RecommendationItem) which wraps the Recommendation in a .recommendation property.
  // When invoked from the dashboard webview, we receive { featureID }.
  let rec: Recommendation | undefined;
  if (arg && 'recommendation' in arg) {
    rec = arg.recommendation;
  } else if (arg && 'featureID' in arg && !('matrixScore' in arg)) {
    // From dashboard webview — look up the feature and build a minimal rec
    const feature = catalog().find((f) => f.id === arg.featureID);
    if (feature) {
      rec = buildRecommendation(feature, 'Show me');
    }
  } else {
    rec = arg as Recommendation | undefined;
  }

  if (!rec) {
    // No recommendation passed — let user pick one
    if (!lastResult) {
      vscode.window.showWarningMessage('Run a full analysis first.');
      return;
    }

    const tutorialFeatureIDs = new Set(Object.keys(tutorialPrompts));
    const tutorialable = lastResult.topRecommendations.filter((r) => tutorialFeatureIDs.has(r.featureID));

    // Also check agent reports for more tutorialable recs
    if (tutorialable.length === 0) {
      for (const ar of lastResult.agentReports) {
        for (const r of ar.recommendations) {
          if (tutorialFeatureIDs.has(r.featureID) && !tutorialable.find((i) => i.featureID === r.featureID)) {
            tutorialable.push(r);
          }
        }
      }
    }

    if (tutorialable.length === 0) {
      vscode.window.showInformationMessage('No tutorial walkthroughs available.');
      return;
    }

    const items = tutorialable.map((r) => ({
      label: `${r.stars} ${r.title}`,
      description: r.description,
      recommendation: r,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a feature to learn about with Copilot',
    });

    if (!picked) {
      return;
    }

    rec = picked.recommendation;
  }

  // At this point, rec is guaranteed to be defined
  const featureID = rec.featureID;
  const title = rec.title;

  // Get the tutorial prompt for this feature
  const prompt = tutorialPrompts[featureID];
  if (!prompt) {
    vscode.window.showErrorMessage(`No tutorial walkthrough available for: ${title}`);
    return;
  }

  // Open Copilot Chat with the tutorial prompt
  const message = prompt;

  // Try to send to Copilot Chat via command
  try {
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: message,
    });
  } catch {
    // Fallback: copy prompt to clipboard
    await vscode.env.clipboard.writeText(message);
    vscode.window.showInformationMessage(
      `Tutorial prompt copied to clipboard. Open Copilot Chat and paste it to learn about ${title}.`,
    );
  }
}

// ─── Hide / Unhide Feature Handlers ───

async function handleHideFeature(
  context: vscode.ExtensionContext,
  item?: FeatureItem,
): Promise<void> {
  let featureId: string | undefined;

  if (item) {
    featureId = item.feature.id;
  } else {
    // Show a quick pick of all visible features
    const allFeatures = catalog();
    const hidden = getHiddenFeatureIDs();
    const visible = allFeatures.filter((f) => !hidden.has(f.id));

    if (visible.length === 0) {
      vscode.window.showInformationMessage('All features are already hidden.');
      return;
    }

    const picked = await vscode.window.showQuickPick(
      visible.map((f) => ({ label: f.name, description: `${f.category} — ${f.id}`, featureId: f.id })),
      { placeHolder: 'Select a feature to hide from analysis and recommendations' },
    );
    if (!picked) { return; }
    featureId = picked.featureId;
  }

  if (!featureId) { return; }

  const config = vscode.workspace.getConfiguration('copilotEnabler');
  const current = config.get<string[]>('hiddenFeatures', []);
  if (!current.includes(featureId)) {
    current.push(featureId);
    await config.update('hiddenFeatures', current, vscode.ConfigurationTarget.Global);
  }
  // Re-run analysis to reflect changes
  await handleAnalyze(context, true);
}

async function handleUnhideFeature(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('copilotEnabler');
  const current = config.get<string[]>('hiddenFeatures', []);

  if (current.length === 0) {
    vscode.window.showInformationMessage('No features are currently hidden.');
    return;
  }

  const allFeatures = catalog();
  const featureMap = new Map(allFeatures.map((f) => [f.id, f]));
  const items = current.map((id) => {
    const f = featureMap.get(id);
    return { label: f?.name ?? id, description: f ? `${f.category} — ${id}` : id, featureId: id };
  });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a feature to unhide',
    canPickMany: true,
  });

  if (!picked || picked.length === 0) { return; }

  const toUnhide = new Set(picked.map((p) => p.featureId));
  const updated = current.filter((id) => !toUnhide.has(id));
  await config.update('hiddenFeatures', updated, vscode.ConfigurationTarget.Global);
  await handleAnalyze(context, true);
}

async function handleResetHiddenFeatures(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('copilotEnabler');
  const current = config.get<string[]>('hiddenFeatures', []);

  if (current.length === 0) {
    vscode.window.showInformationMessage('No features are currently hidden.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `This will unhide all ${current.length} hidden feature(s). Continue?`,
    { modal: true },
    'Reset',
  );
  if (confirm !== 'Reset') { return; }

  await config.update('hiddenFeatures', [], vscode.ConfigurationTarget.Global);
  await handleAnalyze(context, true);
}
