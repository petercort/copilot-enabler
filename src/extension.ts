// Extension entry point — replaces cmd/copilot-analyzer/main.go + cli/cli.go

import * as vscode from 'vscode';
import { runAnalysis, AnalysisResult } from './core/analyzer';
import { scanSettings } from './core/scanner/settings';
import { scanWorkspace } from './core/scanner/workspace';
import { scanExtensions } from './core/scanner/extensions';
import { scanCopilotLogs } from './core/scanner/logs';
import { catalog } from './core/featureCatalog';
import { generateMarkdownReport } from './core/report';
import { implementableFeatures, systemPrompts } from './core/prompts';
import { FeatureTreeProvider } from './views/featureTreeProvider';
import { RecommendationTreeProvider } from './views/recommendationTree';
import { StatusBarManager } from './views/statusBar';
import { DashboardPanel } from './views/dashboardPanel';
import { Recommendation } from './core/agents';

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
    vscode.window.registerTreeDataProvider('developerEnabler.features', featureTree),
    vscode.window.registerTreeDataProvider('developerEnabler.recommendations', recommendationTree),
  );

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('developerEnabler.analyze', () => handleAnalyze(context)),
    vscode.commands.registerCommand('developerEnabler.featureMatrix', () => handleFeatureMatrix(context)),
    vscode.commands.registerCommand('developerEnabler.exportReport', () => handleExportReport()),
    vscode.commands.registerCommand('developerEnabler.featureCatalog', () => handleFeatureCatalog()),
    vscode.commands.registerCommand('developerEnabler.implement', (rec?: Recommendation) => handleImplement(rec)),
    vscode.commands.registerCommand('developerEnabler.refresh', () => handleAnalyze(context)),
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
      e.affectsConfiguration('editor.inlineSuggest')
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

async function handleExportReport(): Promise<void> {
  if (!lastResult) {
    vscode.window.showWarningMessage('Run a full analysis first.');
    return;
  }

  const markdown = generateMarkdownReport(lastResult);

  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file('copilot-adoption-report.md'),
    filters: { Markdown: ['md'] },
  });

  if (uri) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(markdown, 'utf-8'));
    vscode.window.showInformationMessage(`Report saved to ${uri.fsPath}`);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  }
}

function handleFeatureCatalog(): void {
  // Focus the feature catalog tree view
  vscode.commands.executeCommand('developerEnabler.features.focus');
}

async function handleImplement(rec?: Recommendation): Promise<void> {
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

  // Get the system prompt for this feature
  const prompt = systemPrompts[rec.featureID];
  if (!prompt) {
    vscode.window.showErrorMessage(`No interactive implementation available for: ${rec.title}`);
    return;
  }

  // Open Copilot Chat with pre-filled message
  const message = `I want to set up ${rec.title} for my project. Here's the context:\n\n${prompt}\n\nPlease start by reading my project context and then guide me through it.`;

  // Try to send to Copilot Chat via command
  try {
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: message,
    });
  } catch {
    // Fallback: copy prompt to clipboard
    await vscode.env.clipboard.writeText(message);
    vscode.window.showInformationMessage(
      `Prompt copied to clipboard. Open Copilot Chat and paste it to get started with setting up ${rec.title}.`,
    );
  }
}
