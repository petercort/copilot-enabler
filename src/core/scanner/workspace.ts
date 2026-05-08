// Workspace scanner — detects Copilot config files using feature detectHints.

import * as vscode from 'vscode';
import { getHintIndex } from '../features/hintIndex';

/** WorkspaceResult holds results of scanning a workspace for Copilot config files. */
export interface WorkspaceResult {
  root: string;
  filesFound: Map<string, boolean>;
  detectedHints: Map<string, boolean>;
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

  const fileHints = getHintIndex().filePathHints;

  // Scan in parallel — findFiles is independent per pattern.
  const results = await Promise.all(
    fileHints.map(async (hint) => {
      const isGlob = hint.includes('*');
      const pattern = new vscode.RelativePattern(folders[0], hint);
      const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', isGlob ? 10 : 1);
      return [hint, files] as const;
    }),
  );

  for (const [hint, files] of results) {
    for (const file of files) {
      const relPath = vscode.workspace.asRelativePath(file);
      r.filesFound.set(relPath, true);
      r.detectedHints.set(hint.toLowerCase(), true);
    }
  }

  return r;
}
