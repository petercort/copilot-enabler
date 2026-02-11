// Status bar adoption score widget

import * as vscode from 'vscode';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.command = 'copilotEnabler.analyze';
    this.statusBarItem.tooltip = 'Copilot Enabler — Click to run analysis';
    this.statusBarItem.text = '$(pulse) Copilot: --/100';
    this.statusBarItem.show();
  }

  update(score: number, usedFeatures: number, totalFeatures: number): void {
    this.statusBarItem.text = `$(pulse) Copilot: ${score}/100`;
    this.statusBarItem.tooltip = `Copilot Enabler — ${usedFeatures}/${totalFeatures} features detected (Score: ${score}/100)\nClick to run full analysis`;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
