// Registry barrel - collects all feature definitions
// This file is automatically updated when you run `npm run new-feature`

import { FeatureDefinition } from './definition';

/**
 * All registered feature definitions.
 * Import new feature files here and add them to the array.
 */
export const allFeatureDefinitions: FeatureDefinition[] = [
  // Features will be added here as they are migrated
];

/**
 * Get all feature definitions
 */
export function getFeatureDefinitions(): FeatureDefinition[] {
  return allFeatureDefinitions;
}
