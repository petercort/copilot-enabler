// Port of internal/scanner/extensions.go — uses VS Code extensions API directly.

import * as vscode from 'vscode';

/** Extension represents an installed VS Code extension. */
export interface ExtensionInfo {
  id: string;
  version: string;
}

/** ExtensionsResult holds results of scanning for VS Code extensions. */
export interface ExtensionsResult {
  found: boolean;
  extensions: ExtensionInfo[];
  copilotCore?: ExtensionInfo;
  copilotChat?: ExtensionInfo;
  detectedHints: Map<string, boolean>;
}

/**
 * ScanExtensions uses the vscode.extensions.all API to enumerate installed
 * extensions. No file system scanning required — this replaces the entire
 * getExtensionsDir() + parseExtensionDir() chain from the Go version.
 */
export function scanExtensions(): ExtensionsResult {
  const r: ExtensionsResult = {
    found: true,
    extensions: [],
    detectedHints: new Map(),
  };

  for (const ext of vscode.extensions.all) {
    // Skip built-in extensions
    if (ext.packageJSON?.isBuiltin) {
      continue;
    }

    const info: ExtensionInfo = {
      id: ext.id,
      version: ext.packageJSON?.version ?? '',
    };

    r.extensions.push(info);

    if (!ext.id) { continue; }
    const lower = ext.id.toLowerCase();
    if (lower === 'github.copilot') {
      r.copilotCore = info;
    } else if (lower === 'github.copilot-chat') {
      r.copilotChat = info;
      r.detectedHints.set('copilot.chat', true);
    }

    if (lower.includes('mcp')) {
      r.detectedHints.set('mcp-server', true);
    }
    if (lower.includes('chatparticipant') || lower.includes('chat-participant')) {
      r.detectedHints.set('chat participant', true);
    }
  }

  return r;
}
