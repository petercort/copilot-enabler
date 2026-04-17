import {
  cachedCostUsdPer100Turns,
  cacheSavingsUsdPer100Turns,
  costModelFor,
  estimateUsdPer100Turns,
  rateFor,
} from '../core/promptimizer/cost';

describe('Promptimizer - cost model', () => {
  test('Sonnet 4.6 fresh/write5m/write1h/read multipliers per §5.2', () => {
    const m = costModelFor('claude-sonnet-4.6');
    expect(m.fresh).toBeCloseTo(3.0, 6);
    expect(m.write5m).toBeCloseTo(3.75, 6);
    expect(m.write1h).toBeCloseTo(6.0, 6);
    expect(m.read).toBeCloseTo(0.3, 6);
  });

  test('§5.2 regression: 20k tokens × 100 turns = $6.00 uncached', () => {
    const uncached = estimateUsdPer100Turns(20_000, 'claude-sonnet-4.6', 'fresh', 100);
    expect(uncached).toBeCloseTo(6.0, 4);
  });

  test('§5.2 regression: 5m cached (1 write + 99 reads) ≈ $0.67', () => {
    const cached = cachedCostUsdPer100Turns(20_000, 'claude-sonnet-4.6', 'write5m', 100);
    // 20k * 3.75 / 1e6 + 20k * 99 * 0.30 / 1e6 = 0.075 + 0.594 = 0.669
    expect(cached).toBeCloseTo(0.669, 3);
    expect(Number(cached.toFixed(2))).toBe(0.67);
  });

  test('cacheSavingsUsdPer100Turns = uncached - cached', () => {
    const savings = cacheSavingsUsdPer100Turns(20_000, 'claude-sonnet-4.6', 'write5m', 100);
    expect(savings).toBeCloseTo(6.0 - 0.669, 3);
  });

  test('rateFor throws on unknown model/tier', () => {
    expect(() => rateFor('not-a-model' as never, 'fresh')).toThrow();
    expect(() => rateFor('claude-sonnet-4.6', 'weird' as never)).toThrow();
  });

  test('supports all four pricing models', () => {
    expect(costModelFor('claude-sonnet-4.5').fresh).toBe(3.0);
    expect(costModelFor('claude-opus-4.7').fresh).toBe(15.0);
    expect(costModelFor('claude-opus-4.6').fresh).toBe(15.0);
  });
});
