// Feature Catalog TreeView — port of handleFeatureCatalog() from cli.go

import * as vscode from 'vscode';
import { Feature, Category, allCategories, featuresByCategory, visibleCatalog, getFeatureAvailability } from '../core/featureCatalog';
import { hasTutorial, canImplement } from '../core/prompts';

type TreeItem = CategoryItem | FeatureItem;

class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly category: Category,
    public readonly features: Feature[],
    private readonly usedIDs: Set<string>,
  ) {
    super(category, vscode.TreeItemCollapsibleState.Expanded);
    // Exclude unavailable features from the ratio
    const available = features.filter((f) => getFeatureAvailability(f) !== 'unavailable');
    const detectable = available.filter((f) => f.detectHints.length > 0);
    const used = detectable.filter((f) => usedIDs.has(f.id)).length;
    this.description = detectable.length > 0 ? `${used}/${detectable.length}` : '';
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

export class FeatureItem extends vscode.TreeItem {
  constructor(
    public readonly feature: Feature,
    public readonly detected: boolean,
  ) {
    super(feature.name, vscode.TreeItemCollapsibleState.None);
    const availability = getFeatureAvailability(feature);
    if (availability === 'unavailable') {
      this.description = `Requires v${feature.addedIn}+`;
      this.iconPath = new vscode.ThemeIcon('circle-slash');
      this.contextValue = 'featureUnavailable';
    } else if (feature.detectHints.length === 0) {
      this.description = '';
      this.iconPath = new vscode.ThemeIcon('dash');
      this.contextValue = 'featureNotDetectable';
    } else {
      const newSuffix = availability === 'new' ? ' · New' : '';
      this.description = detected ? `Using${newSuffix}` : `Not detected${newSuffix}`;
      this.iconPath = new vscode.ThemeIcon(detected ? 'check' : (availability === 'new' ? 'star-full' : 'circle-outline'));
      this.contextValue = detected ? 'featureUsed' : 'featureUnused';
    }
    this.tooltip = new vscode.MarkdownString(
      `**${feature.name}**\n\n${feature.description}\n\n` +
        `[Documentation](${feature.docsURL})`,
    );

    // Unavailable features only link to docs; no implement/tutorial actions
    if (availability === 'unavailable') {
      if (feature.docsURL) {
        this.command = {
          command: 'vscode.open',
          title: 'Open Documentation',
          arguments: [vscode.Uri.parse(feature.docsURL)],
        };
      }
      return;
    }

    // Click order: tutorial prompt -> setup prompt -> docs
    if (hasTutorial(feature.id)) {
      this.command = {
        command: 'copilotEnabler.showMe',
        title: 'Open Tutorial',
        arguments: [{ featureID: feature.id }],
      };
    } else if (canImplement(feature.id)) {
      this.command = {
        command: 'copilotEnabler.implement',
        title: 'Open Setup Prompt',
        arguments: [{ featureID: feature.id }],
      };
    } else if (feature.docsURL) {
      this.command = {
        command: 'vscode.open',
        title: 'Open Documentation',
        arguments: [vscode.Uri.parse(feature.docsURL)],
      };
    }
  }
}

export class FeatureTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private usedIDs = new Set<string>();

  refresh(usedIDs: Set<string>): void {
    this.usedIDs = usedIDs;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      // Root: return categories
      const features = visibleCatalog();
      const byCat = featuresByCategory(features);
      return allCategories
        .filter((cat) => (byCat.get(cat)?.length ?? 0) > 0)
        .map((cat) => new CategoryItem(cat, byCat.get(cat)!, this.usedIDs));
    }

    if (element instanceof CategoryItem) {
      return element.features.map(
        (f) => new FeatureItem(f, this.usedIDs.has(f.id)),
      );
    }

    return [];
  }
}
