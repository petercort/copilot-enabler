import {
  mergeHints,
  featureDetected,
  featureNames,
  matrixScore,
  starsFromScore,
  buildRecommendation,
} from '../core/agents/helpers';
import { Feature } from '../core/featureCatalog';

describe('Agent Helpers', () => {
  describe('mergeHints', () => {
    test('merges multiple maps', () => {
      const a = new Map([['foo', true], ['bar', false]]);
      const b = new Map([['baz', true], ['bar', true]]);
      const result = mergeHints(a, b);
      expect(result.get('foo')).toBe(true);
      expect(result.get('baz')).toBe(true);
      expect(result.get('bar')).toBe(true);
    });

    test('empty maps return empty', () => {
      const result = mergeHints(new Map(), new Map());
      expect(result.size).toBe(0);
    });
  });

  describe('featureDetected', () => {
    const feature: Feature = {
      id: 'test',
      name: 'Test Feature',
      category: 'Modes',
      description: 'test',
      docsURL: 'https://example.com',
      detectHints: ['ask mode', 'askMode'],
      tags: ['core'],
      impact: 'high',
      difficulty: 'low',
      setupSteps: ['step 1'],
    };

    test('returns true when hint matches', () => {
      const hints = new Map([['ask mode', true]]);
      expect(featureDetected(feature, hints)).toBe(true);
    });

    test('returns false when no hint matches', () => {
      const hints = new Map([['edit mode', true]]);
      expect(featureDetected(feature, hints)).toBe(false);
    });

    test('case-insensitive match on hints', () => {
      const hints = new Map([['askmode', true]]);
      expect(featureDetected(feature, hints)).toBe(true);
    });
  });

  describe('featureNames', () => {
    test('returns names', () => {
      const features: Feature[] = [
        { id: 'a', name: 'Alpha', category: 'Modes', description: '', docsURL: '', detectHints: [], tags: [], impact: 'low', difficulty: 'low', setupSteps: [] },
        { id: 'b', name: 'Beta', category: 'Modes', description: '', docsURL: '', detectHints: [], tags: [], impact: 'low', difficulty: 'low', setupSteps: [] },
      ];
      expect(featureNames(features)).toEqual(['Alpha', 'Beta']);
    });
  });

  describe('matrixScore', () => {
    const tests = [
      { impact: 'high', difficulty: 'low', expected: 9 },
      { impact: 'high', difficulty: 'medium', expected: 6 },
      { impact: 'high', difficulty: 'high', expected: 3 },
      { impact: 'medium', difficulty: 'low', expected: 6 },
      { impact: 'medium', difficulty: 'medium', expected: 4 },
      { impact: 'medium', difficulty: 'high', expected: 2 },
      { impact: 'low', difficulty: 'low', expected: 3 },
      { impact: 'low', difficulty: 'medium', expected: 2 },
      { impact: 'low', difficulty: 'high', expected: 1 },
    ];

    for (const tt of tests) {
      test(`${tt.impact}/${tt.difficulty} = ${tt.expected}`, () => {
        expect(matrixScore(tt.impact, tt.difficulty)).toBe(tt.expected);
      });
    }
  });

  describe('starsFromScore', () => {
    const tests = [
      { score: 9, expected: '★★★' },
      { score: 10, expected: '★★★' },
      { score: 6, expected: '★★☆' },
      { score: 8, expected: '★★☆' },
      { score: 3, expected: '★☆☆' },
      { score: 5, expected: '★☆☆' },
      { score: 1, expected: '☆☆☆' },
      { score: 2, expected: '☆☆☆' },
    ];

    for (const tt of tests) {
      test(`score ${tt.score} = ${tt.expected}`, () => {
        expect(starsFromScore(tt.score)).toBe(tt.expected);
      });
    }
  });

  describe('buildRecommendation', () => {
    test('creates recommendation from feature', () => {
      const feature: Feature = {
        id: 'mode-agent',
        name: 'Agent Mode',
        category: 'Modes',
        description: 'Autonomous agent mode',
        docsURL: 'https://example.com',
        detectHints: ['agent mode'],
        tags: ['core'],
        impact: 'high',
        difficulty: 'low',
        setupSteps: ['Step 1', 'Step 2'],
      };

      const rec = buildRecommendation(feature, 'Try');
      expect(rec.featureID).toBe('mode-agent');
      expect(rec.title).toBe('Try Agent Mode');
      expect(rec.matrixScore).toBe(9);
      expect(rec.stars).toBe('★★★');
      expect(rec.impact).toBe('high');
      expect(rec.difficulty).toBe('low');
      expect(rec.actionItems).toEqual(['Step 1', 'Step 2']);
    });
  });
});
