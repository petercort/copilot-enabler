// Recommendations TreeView

import * as vscode from 'vscode';
import { Recommendation } from '../core/agents';
import { implementableFeatures } from '../core/prompts';
import { visibleCatalog, getFeatureAvailability } from '../core/featureCatalog';

class RecommendationItem extends vscode.TreeItem {
  constructor(public readonly recommendation: Recommendation) {
    super(
      `${recommendation.stars} ${recommendation.title}`,
      vscode.TreeItemCollapsibleState.None,
    );

    // Check if this recommendation's feature is "new"
    const featureCatalog = visibleCatalog();
    const feature = featureCatalog.find((f) => f.id === recommendation.featureID);
    const newSuffix = (feature && getFeatureAvailability(feature) === 'new') ? ' · New' : '';

    this.description = recommendation.description + newSuffix;
    this.tooltip = new vscode.MarkdownString(
      `**${recommendation.title}**\n\n${recommendation.description}\n\n` +
        `**Steps:**\n${recommendation.actionItems.map((s) => `1. ${s}`).join('\n')}\n\n` +
        `[Documentation](${recommendation.docsURL})`,
    );

    const canImplement = implementableFeatures().has(recommendation.featureID);
    this.contextValue = canImplement ? 'implementable' : 'recommendation';
    this.iconPath = new vscode.ThemeIcon(canImplement ? 'lightbulb' : 'info');

    if (recommendation.docsURL) {
      this.command = {
        command: 'vscode.open',
        title: 'Open Documentation',
        arguments: [vscode.Uri.parse(recommendation.docsURL)],
      };
    }
  }
}

export class RecommendationTreeProvider implements vscode.TreeDataProvider<RecommendationItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<RecommendationItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private recommendations: Recommendation[] = [];

  refresh(recommendations: Recommendation[]): void {
    this.recommendations = recommendations;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: RecommendationItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: RecommendationItem): RecommendationItem[] {
    if (element) {
      return [];
    }
    // Suppress recommendations for unavailable features
    const featureCatalog = visibleCatalog();
    const filtered = this.recommendations.filter((r) => {
      const feature = featureCatalog.find((f) => f.id === r.featureID);
      return !feature || getFeatureAvailability(feature) !== 'unavailable';
    });
    return filtered.map((r) => new RecommendationItem(r));
  }
}
