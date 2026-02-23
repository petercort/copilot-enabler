export type { Agent, AgentReport, AnalysisContext, Recommendation } from './agent';
export { mergeHints, featureDetected, featureNames, matrixScore, starsFromScore, buildRecommendation } from './helpers';
export { CoreAgent } from './modes';
export { CustomizationsAgent } from './customizations';
export { AdoptionAgent } from './adoption';

import { Agent } from './agent';
import { CoreAgent } from './modes';
import { CustomizationsAgent } from './customizations';
import { AdoptionAgent } from './adoption';

/** AllAgents returns the full set of registered agents. */
export function allAgents(): Agent[] {
  return [
    new CoreAgent(),
    new CustomizationsAgent(),
    new AdoptionAgent(),
  ];
}
