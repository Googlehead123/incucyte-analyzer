import { describe, it, expect } from 'vitest';
import { adjustPValues, starsFor, CORRECTION_METHODS } from '../multipleComparisons';

describe('starsFor', () => {
  it('maps p-values to the conventional star thresholds', () => {
    expect(starsFor(0.0005)).toBe('***');
    expect(starsFor(0.005)).toBe('**');
    expect(starsFor(0.04)).toBe('*');
    expect(starsFor(0.06)).toBe('ns');
  });

  it('treats missing p-values as non-significant rather than throwing', () => {
    expect(starsFor(null)).toBe('ns');
    expect(starsFor(undefined)).toBe('ns');
    expect(starsFor(NaN)).toBe('ns');
  });
});

describe('adjustPValues', () => {
  const three = [
    { key: 'a', p: 0.01 },
    { key: 'b', p: 0.04 },
    { key: 'c', p: 0.20 },
  ];

  it('returns raw p-values unchanged when correction is off', () => {
    const out = adjustPValues(three, 'none');
    expect(out.a.p).toBe(0.01);
    expect(out.b.p).toBe(0.04);
    expect(out.c.p).toBe(0.20);
    expect(out.a.pRaw).toBe(0.01);
  });

  it('multiplies by the family size for Bonferroni and caps at 1', () => {
    const out = adjustPValues(three, 'bonferroni');
    expect(out.a.p).toBeCloseTo(0.03, 10);
    expect(out.b.p).toBeCloseTo(0.12, 10);
    expect(out.c.p).toBeCloseTo(0.6, 10); // 0.20 * 3, below the cap
  });

  it('caps Bonferroni output at 1', () => {
    const out = adjustPValues([{ key: 'x', p: 0.9 }, { key: 'y', p: 0.9 }], 'bonferroni');
    expect(out.x.p).toBe(1);
  });

  it('applies the Holm-Sidak step-down formula', () => {
    const out = adjustPValues(three, 'holmSidak');
    // smallest of 3: 1-(1-0.01)^3
    expect(out.a.p).toBeCloseTo(1 - Math.pow(0.99, 3), 10);
    // second of 3 -> 2 remaining: 1-(1-0.04)^2
    expect(out.b.p).toBeCloseTo(1 - Math.pow(0.96, 2), 10);
    // largest -> 1 remaining: unchanged
    expect(out.c.p).toBeCloseTo(0.20, 10);
  });

  it('is uniformly less conservative than Bonferroni', () => {
    const holm = adjustPValues(three, 'holmSidak');
    const bonf = adjustPValues(three, 'bonferroni');
    for (const k of ['a', 'b', 'c']) {
      expect(holm[k].p).toBeLessThanOrEqual(bonf[k].p + 1e-12);
    }
  });

  it('enforces monotonicity so an adjusted p can never undercut a smaller-ranked one', () => {
    // Raw values close together would otherwise produce a non-monotonic sequence.
    const out = adjustPValues(
      [{ key: 'a', p: 0.04 }, { key: 'b', p: 0.041 }, { key: 'c', p: 0.042 }],
      'holmSidak'
    );
    expect(out.a.p).toBeLessThanOrEqual(out.b.p);
    expect(out.b.p).toBeLessThanOrEqual(out.c.p);
  });

  it('recomputes stars from the adjusted value, not the raw one', () => {
    // 0.04 is a single star raw, but loses significance across 3 comparisons.
    const out = adjustPValues(three, 'bonferroni');
    expect(out.b.pRaw).toBe(0.04);
    expect(out.b.stars).toBe('ns');
    expect(out.b.significant).toBe(false);
  });

  it('never adjusts a single comparison', () => {
    const out = adjustPValues([{ key: 'only', p: 0.03 }], 'holmSidak');
    expect(out.only.p).toBeCloseTo(0.03, 10);
    expect(out.only.stars).toBe('*');
  });

  it('handles empty and malformed input without throwing', () => {
    expect(adjustPValues([], 'holmSidak')).toEqual({});
    expect(adjustPValues(null, 'holmSidak')).toEqual({});
    expect(adjustPValues([{ key: 'a', p: NaN }], 'holmSidak')).toEqual({});
  });

  it('exposes human-readable method labels for export provenance', () => {
    expect(CORRECTION_METHODS.none).toBe('Uncorrected');
    expect(CORRECTION_METHODS.holmSidak).toBe('Holm-Sidak');
  });
});
