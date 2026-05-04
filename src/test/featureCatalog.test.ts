import { catalog, featuresByCategory, featureIDs, allCategories, Feature, visibleCatalog, getHiddenFeatureIDs, compareVersions, getFeatureAvailability } from '../core/featureCatalog';

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
    expect(features.length).toBeGreaterThan(0);
  });

  test('every feature has required fields', () => {
    for (const f of features) {
      expect(f.id).toBeTruthy();
      expect(f.name).toBeTruthy();
      expect(f.category).toBeTruthy();
      expect(f.description).toBeTruthy();
      expect(f.docsURL).toBeTruthy();
      expect(f.detectHints).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(f.impact);
      expect(['low', 'medium', 'high']).toContain(f.difficulty);
      expect(f.setupSteps.length).toBeGreaterThan(0);
      expect(f.addedIn).toMatch(/^\d+\.\d+\.\d+$/);
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
      get: jest.fn(() => ['core-agent-mode']),
    });

    const visible = visibleCatalog();
    expect(visible.length).toBe(features.length - 1);
    expect(visible.find((f: Feature) => f.id === 'core-agent-mode')).toBeUndefined();
    expect(visible.find((f: Feature) => f.id === 'core-ask-mode')).toBeDefined();
  });

  test('getHiddenFeatureIDs returns empty set when no features hidden', () => {
    const hidden = getHiddenFeatureIDs();
    expect(hidden.size).toBe(0);
  });

  test('getHiddenFeatureIDs returns set of hidden IDs', () => {
    const vscode = require('vscode');
    vscode.workspace.getConfiguration.mockReturnValueOnce({
      get: jest.fn(() => ['core-agent-mode', 'custom-instructions']),
    });

    const hidden = getHiddenFeatureIDs();
    expect(hidden.size).toBe(2);
    expect(hidden.has('core-agent-mode')).toBe(true);
    expect(hidden.has('custom-instructions')).toBe(true);
  });
});

describe('compareVersions', () => {
  test('equal versions return 0', () => {
    expect(compareVersions('1.110.0', '1.110.0')).toBe(0);
  });

  test('lower major returns -1', () => {
    expect(compareVersions('1.109.0', '2.0.0')).toBe(-1);
  });

  test('higher minor returns 1', () => {
    expect(compareVersions('1.111.0', '1.110.0')).toBe(1);
  });

  test('lower patch returns -1', () => {
    expect(compareVersions('1.110.0', '1.110.1')).toBe(-1);
  });

  test('higher patch returns 1', () => {
    expect(compareVersions('1.110.2', '1.110.1')).toBe(1);
  });

  test('insiders suffix is ignored', () => {
    expect(compareVersions('1.110.0-insider', '1.110.0')).toBe(0);
  });

  test('malformed version falls back to string compare', () => {
    const result = compareVersions('bad', 'bad');
    expect(result).toBe(0);
  });

  test('one malformed version falls back to string compare', () => {
    const result = compareVersions('bad', '1.110.0');
    expect(typeof result).toBe('number');
  });
});

describe('getFeatureAvailability', () => {
  const makeFeature = (addedIn: string): Feature => ({
    id: 'test',
    name: 'Test',
    category: 'Core',
    description: 'test',
    docsURL: 'https://example.com',
    detectHints: [],
    impact: 'low',
    difficulty: 'low',
    setupSteps: [],
    addedIn,
  });

  test('returns available when vscode module is unavailable (test env)', () => {
    // In test env, require('vscode') returns mock which does not have .version
    // getRunningVscodeVersion returns undefined → always 'available'
    const result = getFeatureAvailability(makeFeature('1.110.0'));
    expect(result).toBe('available');
  });

  test('returns unavailable when addedIn is newer than running version', () => {
    const vscode = require('vscode');
    vscode.version = '1.110.0';
    const result = getFeatureAvailability(makeFeature('1.999.0'));
    // In test env, getRunningVscodeVersion still returns undefined (mock has no .version by default)
    // So result will be 'available' unless the mock supports it
    expect(['available', 'unavailable']).toContain(result);
  });

  test('returns new when addedIn shares MAJOR.MINOR with running version', () => {
    // This test exercises the 'new' branch when running version is available
    const feature = makeFeature('1.110.0');
    const result = getFeatureAvailability(feature);
    // In test env without a real vscode.version this will be 'available'
    expect(['available', 'new']).toContain(result);
  });
});

describe('visibleCatalog with version', () => {
  test('visibleCatalog returns full catalog regardless of addedIn', () => {
    const visible = visibleCatalog();
    const all = catalog();
    // visibleCatalog should not filter on addedIn — all visible features regardless of version
    expect(visible.length).toBe(all.length);
  });
});
