// Feature Catalog TreeView — port of handleFeatureCatalog() from cli.go

import * as vscode from 'vscode';
import { Feature, Category, allCategories, featuresByCategory, catalog } from '../core/featureCatalog';

type TreeItem = CategoryItem | FeatureItem;

class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly category: Category,
    public readonly features: Feature[],
    private readonly usedIDs: Set<string>,
  ) {
    super(category, vscode.TreeItemCollapsibleState.Expanded);
    const used = features.filter((f) => usedIDs.has(f.id)).length;
    this.description = `${used}/${features.length}`;
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

class FeatureItem extends vscode.TreeItem {
  constructor(
    public readonly feature: Feature,
    public readonly detected: boolean,
  ) {
    super(feature.name, vscode.TreeItemCollapsibleState.None);
    this.description = detected ? 'Using' : 'Not detected';
    this.iconPath = new vscode.ThemeIcon(detected ? 'check' : 'circle-outline');
    this.tooltip = new vscode.MarkdownString(
      `**${feature.name}**\n\n${feature.description}\n\n` +
        `[Documentation](${feature.docsURL})`,
    );
    this.contextValue = detected ? 'featureUsed' : 'featureUnused';

    if (!detected && feature.docsURL) {
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
      const features = catalog();
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
