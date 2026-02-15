// Feature definition type that bundles metadata, prompts, and detection logic

import { Feature, Category } from '../featureCatalog';

/**
 * FeatureDefinition extends the base Feature interface to include
 * optional system prompts for interactive implementation.
 */
export interface FeatureDefinition extends Feature {
  /** Optional system prompt for interactive Copilot implementation sessions */
  systemPrompt?: string;
  /** Optional tutorial prompt for interactive feature walkthroughs */
  tutorialPrompt?: string;
}

/**
 * Helper function to create a feature definition with type safety
 */
export function defineFeature(definition: FeatureDefinition): FeatureDefinition {
  return definition;
}
