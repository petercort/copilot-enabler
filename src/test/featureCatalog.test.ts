import { catalog, featuresByCategory, featureIDs, allCategories, Feature, visibleCatalog, getHiddenFeatureIDs } from '../core/featureCatalog';

// Mock vscode module for tests
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(() => []),
    })),
  },
}), { virtual: true });

describe('Feature Catalog', () => {
  let features: Feature[];

  beforeAll(() => {
    features = catalog();
  });

  test('catalog returns all features', () => {
    expect(features.length).toBe(25);
  });

  test('every feature has required fields', () => {
    for (const f of features) {
      expect(f.id).toBeTruthy();
      expect(f.name).toBeTruthy();
      expect(f.category).toBeTruthy();
      expect(f.description).toBeTruthy();
      expect(f.docsURL).toBeTruthy();
      expect(f.detectHints.length).toBeGreaterThan(0);
      expect(f.tags.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(f.impact);
      expect(['low', 'medium', 'high']).toContain(f.difficulty);
      expect(f.setupSteps.length).toBeGreaterThan(0);
    }
  });

  test('every feature ID is unique', () => {
    const ids = featureIDs(features);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test('every feature belongs to a known category', () => {
    for (const f of features) {
      expect(allCategories).toContain(f.category);
    }
  });

  test('featuresByCategory groups correctly', () => {
    const byCat = featuresByCategory(features);
    let total = 0;
    for (const [, catFeatures] of byCat) {
      total += catFeatures.length;
    }
    expect(total).toBe(features.length);
  });

  test('all categories have at least one feature', () => {
    const byCat = featuresByCategory(features);
    for (const cat of allCategories) {
      const catFeatures = byCat.get(cat) ?? [];
      expect(catFeatures.length).toBeGreaterThan(0);
    }
  });

  test('docsURLs are valid URLs', () => {
    for (const f of features) {
      expect(() => new URL(f.docsURL)).not.toThrow();
    }
  });

  test('visibleCatalog returns full catalog when no features hidden', () => {
    const visible = visibleCatalog();
    expect(visible.length).toBe(features.length);
  });

  test('visibleCatalog filters hidden features', () => {
    // Override the vscode mock to return hidden features
    const vscode = require('vscode');
    vscode.workspace.getConfiguration.mockReturnValueOnce({
      get: jest.fn(() => ['mode-edit', 'mode-agent']),
    });

    const visible = visibleCatalog();
    expect(visible.length).toBe(features.length - 2);
    expect(visible.find((f: Feature) => f.id === 'mode-edit')).toBeUndefined();
    expect(visible.find((f: Feature) => f.id === 'mode-agent')).toBeUndefined();
    expect(visible.find((f: Feature) => f.id === 'mode-ask')).toBeDefined();
  });

  test('getHiddenFeatureIDs returns empty set when no features hidden', () => {
    const hidden = getHiddenFeatureIDs();
    expect(hidden.size).toBe(0);
  });

  test('getHiddenFeatureIDs returns set of hidden IDs', () => {
    const vscode = require('vscode');
    vscode.workspace.getConfiguration.mockReturnValueOnce({
      get: jest.fn(() => ['mode-edit', 'custom-instructions-file']),
    });

    const hidden = getHiddenFeatureIDs();
    expect(hidden.size).toBe(2);
    expect(hidden.has('mode-edit')).toBe(true);
    expect(hidden.has('custom-instructions-file')).toBe(true);
  });
});
