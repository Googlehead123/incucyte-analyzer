import { describe, it, expect } from 'vitest';
import { runAnalysis, keyOf } from '../analysis';

const TIMES = [0, 12, 24];

const base = (overrides = {}) => ({
  timepoints: TIMES,
  excludedWells: new Set(),
  outlierMethod: 'none',
  correctionMethod: 'none',
  selectedTimepoint: 24,
  controlConditionIdx: 0,
  ...overrides,
});

describe('runAnalysis', () => {
  it('returns null when there is nothing to analyse', () => {
    expect(runAnalysis(base({ rawData: null, conditions: [] }))).toBeNull();
    expect(runAnalysis(base({ rawData: {}, conditions: [] }))).toBeNull();
  });

  describe('duplicate condition names', () => {
    // The regression this guards: results used to be keyed by name, so the
    // second "Drug A" silently overwrote the first.
    const conditions = [
      { id: 1, name: 'Drug A', wells: ['A1', 'A2', 'A3'] },
      { id: 2, name: 'Drug A', wells: ['B1', 'B2', 'B3'] },
    ];
    const rawData = {
      A1: [0, 10, 20], A2: [0, 11, 21], A3: [0, 12, 22],
      B1: [0, 50, 60], B2: [0, 51, 61], B3: [0, 52, 62],
    };

    it('keeps two identically-named conditions separate', () => {
      const r = runAnalysis(base({ rawData, conditions }));
      expect(Object.keys(r.statistics).sort()).toEqual(['c1', 'c2']);
      expect(r.statistics.c1.mean).toBeCloseTo(21, 5);
      expect(r.statistics.c2.mean).toBeCloseTo(61, 5);
    });

    it('keeps their time-course series separate', () => {
      const r = runAnalysis(base({ rawData, conditions }));
      const t24 = r.timeCourse.find(row => row.time === 24);
      expect(t24.c1_mean).toBeCloseTo(21, 5);
      expect(t24.c2_mean).toBeCloseTo(61, 5);
    });

    it('still identifies the correct control among duplicates', () => {
      const r = runAnalysis(base({ rawData, conditions, controlConditionIdx: 1 }));
      expect(r.controlKey).toBe('c2');
      expect(r.pValues.c2.stars).toBe('-');   // control has no self-test
      expect(r.pValues.c1.p).toBeLessThan(0.05); // 21 vs 61 is a clear difference
    });
  });

  describe('AUC', () => {
    const conditions = [
      { id: 1, name: 'Control', wells: ['A1'] },
      { id: 2, name: 'Treated', wells: ['B1'] },
    ];

    it('integrates by the trapezoidal rule', () => {
      const rawData = { A1: [0, 10, 20], B1: [0, 10, 20] };
      const r = runAnalysis(base({ rawData, conditions }));
      // (0+10)/2*12 + (10+20)/2*12 = 60 + 180 = 240
      expect(r.auc.c1).toBeCloseTo(240, 5);
    });

    it('skips gaps instead of integrating a fabricated zero', () => {
      // A missing midpoint must not be treated as a real measurement of 0.
      const gappy = { A1: [0, null, 20], B1: [0, 10, 20] };
      const r = runAnalysis(base({ rawData: gappy, conditions }));
      // Only t=0 and t=24 are measured: (0+20)/2*24 = 240
      expect(r.auc.c1).toBeCloseTo(240, 5);
      // If the gap had become 0 the area would have collapsed to 120.
      expect(r.auc.c1).not.toBeCloseTo(120, 5);
    });

    it('reports relative AUC as a percentage of the control', () => {
      const rawData = { A1: [0, 10, 20], B1: [0, 20, 40] };
      const r = runAnalysis(base({ rawData, conditions }));
      expect(r.auc.c1_relative).toBe('100.0');
      expect(r.auc.c2_relative).toBe('200.0');
    });

    it('reports relative AUC as unavailable when the control AUC is zero', () => {
      // Previously `controlAUC || 1` divided by a placeholder and emitted a
      // number that looked meaningful but was not.
      const rawData = { A1: [0, 0, 0], B1: [0, 20, 40] };
      const r = runAnalysis(base({ rawData, conditions }));
      expect(r.auc.c1).toBe(0);
      expect(r.auc.c2_relative).toBeNull();
    });
  });

  describe('multiple-comparison correction', () => {
    const conditions = [
      { id: 1, name: 'Control', wells: ['A1', 'A2', 'A3'] },
      { id: 2, name: 'T1', wells: ['B1', 'B2', 'B3'] },
      { id: 3, name: 'T2', wells: ['C1', 'C2', 'C3'] },
      { id: 4, name: 'T3', wells: ['D1', 'D2', 'D3'] },
    ];
    const rawData = {
      A1: [0, 5, 10], A2: [0, 5, 11], A3: [0, 5, 12],
      B1: [0, 8, 16], B2: [0, 8, 17], B3: [0, 8, 18],
      C1: [0, 9, 19], C2: [0, 9, 20], C3: [0, 9, 21],
      D1: [0, 6, 13], D2: [0, 6, 14], D3: [0, 6, 15],
    };

    it('excludes the control from the comparison family', () => {
      const r = runAnalysis(base({ rawData, conditions }));
      expect(r.comparisonCount).toBe(3); // not 4
    });

    it('leaves p-values untouched by default, preserving old analyses', () => {
      const r = runAnalysis(base({ rawData, conditions, correctionMethod: 'none' }));
      expect(r.correctionMethod).toBe('Uncorrected');
      for (const k of ['c2', 'c3', 'c4']) {
        expect(r.pValues[k].p).toBeCloseTo(r.pValues[k].pRaw, 12);
      }
    });

    it('raises adjusted p-values above the raw ones when correcting', () => {
      const r = runAnalysis(base({ rawData, conditions, correctionMethod: 'holmSidak' }));
      expect(r.correctionMethod).toBe('Holm-Sidak');
      for (const k of ['c2', 'c3', 'c4']) {
        expect(r.pValues[k].p).toBeGreaterThanOrEqual(r.pValues[k].pRaw);
        expect(r.pValues[k].pRaw).toBeGreaterThan(0);
      }
    });

    it('gives the control a null p-value rather than a fake 1', () => {
      const r = runAnalysis(base({ rawData, conditions }));
      expect(r.pValues.c1.p).toBeNull();
      expect(r.pValues.c1.stars).toBe('-');
    });
  });

  describe('exclusions and outlier handling', () => {
    const conditions = [
      { id: 1, name: 'Control', wells: ['A1', 'A2', 'A3'] },
      { id: 2, name: 'Treated', wells: ['B1', 'B2', 'B3'] },
    ];
    const rawData = {
      A1: [0, 10, 20], A2: [0, 10, 21], A3: [0, 10, 99],
      B1: [0, 30, 40], B2: [0, 30, 41], B3: [0, 30, 42],
    };

    it('drops excluded wells from the statistics', () => {
      const r = runAnalysis(base({ rawData, conditions, excludedWells: new Set(['A3']) }));
      expect(r.statistics.c1.n).toBe(2);
      expect(r.statistics.c1.mean).toBeCloseTo(20.5, 5);
    });

    it('removes the extremes per timepoint under minmax', () => {
      const r = runAnalysis(base({ rawData, conditions, outlierMethod: 'minmax' }));
      expect(r.statistics.c1.n).toBe(1);
      expect(r.statistics.c1.mean).toBeCloseTo(21, 5);
    });

    it('picks representative wells nearest the condition mean', () => {
      const r = runAnalysis(base({ rawData, conditions, excludedWells: new Set(['A3']) }));
      expect(r.representativeWells.c1.map(w => w.well)).toEqual(['A1', 'A2']);
    });

    it('handles a condition with no wells assigned', () => {
      const withEmpty = [...conditions, { id: 3, name: 'Empty', wells: [] }];
      const r = runAnalysis(base({ rawData, conditions: withEmpty }));
      expect(r.statistics.c3.n).toBe(0);
      expect(r.representativeWells.c3).toBeUndefined();
    });

    it('handles an endpoint that is not in the timepoint list', () => {
      const r = runAnalysis(base({ rawData, conditions, selectedTimepoint: 999 }));
      expect(r.timeCourse).toHaveLength(3);
      expect(r.statistics).toEqual({});
    });
  });

  it('derives keys from ids, not array position', () => {
    expect(keyOf({ id: 7 })).toBe('c7');
  });
});
