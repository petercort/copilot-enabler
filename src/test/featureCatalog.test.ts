import { catalog, featuresByCategory, featureIDs, allCategories, Feature } from '../core/featureCatalog';

describe('Feature Catalog', () => {
  let features: Feature[];

  beforeAll(() => {
    features = catalog();
  });

  test('catalog returns 31 features', () => {
    expect(features.length).toBe(31);
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
});
