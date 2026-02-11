// Port of internal/scanner/workspace.go — uses VS Code workspace API.

import * as vscode from 'vscode';

/** WorkspaceResult holds results of scanning a workspace for Copilot config files. */
export interface WorkspaceResult {
  root: string;
  filesFound: Map<string, boolean>;
  detectedHints: Map<string, boolean>;
}

interface ConfigFile {
  path: string;
  hints: string[];
}

const configFiles: ConfigFile[] = [
  { path: '.github/copilot-instructions.md', hints: ['copilot-instructions.md'] },
  { path: '.copilotignore', hints: ['.copilotignore'] },
  { path: '.vscode/mcp.json', hints: ['mcp.json', 'mcpservers'] },
  { path: 'mcp.json', hints: ['mcp.json', 'mcpservers'] },
  { path: '.vscode/settings.json', hints: [] },
  { path: '.devcontainer/devcontainer.json', hints: [] },
];

/**
 * ScanWorkspace checks the workspace for known Copilot configuration files
 * using vscode.workspace.findFiles — no manual path construction needed.
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

  // Check each known config file
  for (const cf of configFiles) {
    const pattern = new vscode.RelativePattern(folders[0], cf.path);
    const files = await vscode.workspace.findFiles(pattern, null, 1);
    if (files.length > 0) {
      r.filesFound.set(cf.path, true);
      for (const h of cf.hints) {
        r.detectedHints.set(h, true);
      }
    }
  }

  // Check for .prompt.md files in .github/prompts/
  const promptPattern = new vscode.RelativePattern(folders[0], '.github/prompts/**/*.prompt.md');
  const promptFiles = await vscode.workspace.findFiles(promptPattern);
  for (const pf of promptFiles) {
    const relPath = vscode.workspace.asRelativePath(pf);
    r.filesFound.set(relPath, true);
    r.detectedHints.set('.prompt.md', true);
  }

  // Check for instruction files in .github/instructions/
  const instrPattern = new vscode.RelativePattern(folders[0], '.github/instructions/**/*');
  const instrFiles = await vscode.workspace.findFiles(instrPattern);
  for (const inf of instrFiles) {
    const relPath = vscode.workspace.asRelativePath(inf);
    r.filesFound.set(relPath, true);
    r.detectedHints.set('copilot-instructions.md', true);
    r.detectedHints.set('modeinstructions', true);
  }

  return r;
}
