// Port of internal/copilot/prompts.go

import { getFeatureDefinitions } from './features/registry';

/** SystemPrompts maps feature IDs to system prompts for interactive Copilot sessions. */
export const systemPrompts: Record<string, string> = {};

// Populate systemPrompts from feature definitions
for (const feature of getFeatureDefinitions()) {
  if (feature.systemPrompt) {
    systemPrompts[feature.id] = feature.systemPrompt;
  }
}

/** ImplementableFeatures returns the set of feature IDs that have interactive implementations. */
export function implementableFeatures(): Set<string> {
  return new Set(Object.keys(systemPrompts));
}

/** CanImplement checks if a recommendation has an interactive implementation. */
export function canImplement(featureID: string): boolean {
  return featureID in systemPrompts;
}
