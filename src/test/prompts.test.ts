import { implementableFeatures, canImplement, systemPrompts, tutorialPrompts, tutorialFeatures, hasTutorial } from '../core/prompts';

describe('Prompts', () => {
  test('has system prompts for implementable features', () => {
    expect(Object.keys(systemPrompts).length).toBeGreaterThan(0);
  });

  test('implementableFeatures returns a set of feature IDs', () => {
    const features = implementableFeatures();
    expect(features.size).toBeGreaterThan(0);
    expect(features.has('custom-instructions-file')).toBe(true);
    expect(features.has('skill-mcp-servers')).toBe(true);
  });

  test('canImplement returns true for known features', () => {
    expect(canImplement('custom-instructions-file')).toBe(true);
    expect(canImplement('custom-copilotignore')).toBe(true);
  });

  test('canImplement returns false for unknown features', () => {
    expect(canImplement('mode-ask')).toBe(false);
    expect(canImplement('nonexistent')).toBe(false);
  });

  test('all prompt values are non-empty strings', () => {
    for (const [, prompt] of Object.entries(systemPrompts)) {
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(50);
    }
  });

  test('has tutorial prompts for features with system prompts', () => {
    expect(Object.keys(tutorialPrompts).length).toBeGreaterThan(0);
  });

  test('tutorialFeatures returns a set of feature IDs', () => {
    const features = tutorialFeatures();
    expect(features.size).toBeGreaterThan(0);
    expect(features.has('custom-instructions-file')).toBe(true);
    expect(features.has('skill-mcp-servers')).toBe(true);
  });

  test('hasTutorial returns true for features with tutorial prompts', () => {
    expect(hasTutorial('custom-instructions-file')).toBe(true);
    expect(hasTutorial('custom-copilotignore')).toBe(true);
  });

  test('hasTutorial returns false for features without tutorial prompts', () => {
    expect(hasTutorial('mode-ask')).toBe(false);
    expect(hasTutorial('nonexistent')).toBe(false);
  });

  test('all tutorial prompt values are non-empty strings', () => {
    for (const [, prompt] of Object.entries(tutorialPrompts)) {
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
    }
  });

  test('features with system prompts also have tutorial prompts', () => {
    const systemFeatures = implementableFeatures();
    const tutorialFeaturesSet = tutorialFeatures();
    
    for (const featureId of systemFeatures) {
      expect(tutorialFeaturesSet.has(featureId)).toBe(true);
    }
  });
});
