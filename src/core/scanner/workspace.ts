// Workspace scanner — detects Copilot config files using feature detectHints.

import * as vscode from 'vscode';
import { getFeatureDefinitions } from '../features/registry';

/** WorkspaceResult holds results of scanning a workspace for Copilot config files. */
export interface WorkspaceResult {
  root: string;
  filesFound: Map<string, boolean>;
  detectedHints: Map<string, boolean>;
}

/** Returns true when a detectHint string looks like a file path or glob pattern. */
function isFilePathHint(hint: string): boolean {
  return hint.includes('/') || hint.includes('*');
}

/**
 * ScanWorkspace checks the workspace for Copilot configuration files
 * by pulling file-path patterns directly from the feature detectHints
 * in the registry — no hardcoded paths.
 */
export async function scanWorkspace(): Promise<WorkspaceResult> {
  const r: WorkspaceResult = {
    root: '',
    filesFound: new Map(),
    detectedHints: new Map(),
  };

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return r;
  }

  r.root = folders[0].uri.fsPath;

  // Collect every file-path hint from the feature registry
  const fileHints: string[] = [];
  for (const feature of getFeatureDefinitions()) {
    for (const raw of feature.detectHints) {
      const hint = typeof raw === 'string' ? raw : raw.hint;
      if (isFilePathHint(hint)) {
        fileHints.push(hint);
      }
    }
  }

  // Scan the workspace for each file-path hint pattern
  for (const hint of fileHints) {
    const pattern = new vscode.RelativePattern(folders[0], hint);
    const isGlob = hint.includes('*');
    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', isGlob ? 10 : 1);
    for (const file of files) {
      const relPath = isGlob ? vscode.workspace.asRelativePath(file) : hint;
      r.filesFound.set(relPath, true);
      r.detectedHints.set(hint.toLowerCase(), true);
    }
  }

  return r;
}
