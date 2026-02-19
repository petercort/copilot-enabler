// Port of internal/copilot/prompts.go

import { getFeatureDefinitions } from './features/registry';

/** SystemPrompts maps feature IDs to system prompts for interactive Copilot sessions. */
export const systemPrompts: Record<string, string> = {};

/** TutorialPrompts maps feature IDs to tutorial prompts for guided feature walkthroughs. */
export const tutorialPrompts: Record<string, string> = {};

// Populate systemPrompts and tutorialPrompts from feature definitions
for (const feature of getFeatureDefinitions()) {
  if (feature.systemPrompt) {
    systemPrompts[feature.id] = feature.systemPrompt;
  }
  if (feature.tutorialPrompt) {
    tutorialPrompts[feature.id] = feature.tutorialPrompt;
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

/** TutorialFeatures returns the set of feature IDs that have tutorial walkthroughs. */
export function tutorialFeatures(): Set<string> {
  return new Set(Object.keys(tutorialPrompts));
}

/** HasTutorial checks if a feature has a tutorial walkthrough. */
export function hasTutorial(featureID: string): boolean {
  return featureID in tutorialPrompts;
}
