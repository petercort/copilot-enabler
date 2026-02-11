// Port of internal/scanner/settings.go — uses VS Code API instead of file I/O.

import * as vscode from 'vscode';
import { detectHintsInText } from './logs';

/** SettingsResult holds the analysis of VS Code settings. */
export interface SettingsResult {
  found: boolean;
  copilotKeys: Record<string, unknown>;
  allKeys: number;
  detectedHints: Map<string, boolean>;
}

/**
 * ScanSettings reads VS Code configuration via the API and extracts
 * Copilot-related keys. No file I/O required — the VS Code API handles
 * platform-specific paths and comment-stripping internally.
 */
export function scanSettings(): SettingsResult {
  const r: SettingsResult = {
    found: false,
    copilotKeys: {},
    allKeys: 0,
    detectedHints: new Map(),
  };

  const config = vscode.workspace.getConfiguration();
  // Inspect known copilot/inlineSuggest sections
  const sections = [
    'github.copilot',
    'github.copilot-chat',
    'editor.inlineSuggest',
  ];

  for (const section of sections) {
    const sectionConfig = vscode.workspace.getConfiguration(section);
    const inspected = config.inspect(section);
    if (inspected) {
      r.found = true;
      // Merge all found values into copilotKeys
      const vals = inspected.globalValue ?? inspected.workspaceValue ?? inspected.defaultValue;
      if (vals && typeof vals === 'object') {
        // Helper to recursively flatten nested settings
        const addSettings = (obj: Record<string, unknown>, prefix: string) => {
          for (const [key, val] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            r.copilotKeys[fullKey] = val;
            r.allKeys++;
            // Directly add the setting key as a hint for feature detection
            r.detectedHints.set(fullKey.toLowerCase(), true);
            if (typeof val === 'string') {
              detectHintsInText(val.toLowerCase(), r.detectedHints);
            } else if (val && typeof val === 'object' && !Array.isArray(val)) {
              // Recursively handle nested settings objects
              addSettings(val as Record<string, unknown>, fullKey);
            }
          }
        };
        addSettings(vals as Record<string, unknown>, section);
      }
    }
  }

  // Also scan workspace-level settings for hint detection
  const wsConfig = vscode.workspace.getConfiguration();
  for (const section of sections) {
    const inspected = wsConfig.inspect(section);
    if (inspected?.workspaceValue && typeof inspected.workspaceValue === 'object') {
      const addSettings = (obj: Record<string, unknown>, prefix: string) => {
        for (const [key, val] of Object.entries(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          // Directly add the setting key as a hint for feature detection
          r.detectedHints.set(fullKey.toLowerCase(), true);
          if (typeof val === 'string') {
            detectHintsInText(val.toLowerCase(), r.detectedHints);
          } else if (val && typeof val === 'object' && !Array.isArray(val)) {
            // Recursively handle nested settings objects
            addSettings(val as Record<string, unknown>, fullKey);
          }
        }
      };
      addSettings(inspected.workspaceValue as Record<string, unknown>, section);
    }
  }

  return r;
}
