// Regression guards for defects raised by an independent Codex review of the
// first audit pass. Each was reproduced before being fixed.

import { describe, it, expect } from 'vitest';
import { parseIncucyteData, calculateAUC, tTest } from '../statistics';
import { runAnalysis } from '../analysis';
import { evaluateWell, detectScanFailures } from '../qc';
import { sanitizeCsvText, buildAnalysisCsv } from '../exportCsv';

describe('a preamble line cannot outscore the real header', () => {
  // The first fix scored candidates by tier then well count. A Notes line reading
  // "bad scan at Elapsed, A1, A2, A3, A4" splits on commas into an Elapsed field
  // plus four well-shaped fields — tier 3 with a HIGHER well count than the real
  // tab header, so it won and the file parsed to zero timepoints.
  const file = [
    'Metric: Relative Wound Density (Percent)',
    'Notes: bad scan at Elapsed, A1, A2, A3, A4',
    'Date Time\tElapsed\t: B2\t: B3\t: B4',
    '2026-01-01 00:00\t0\t0\t0\t0',
    '2026-01-01 06:00\t6\t10\t11\t12',
  ].join('\r\n');

  it('picks the header that actually has data rows under it', () => {
    const r = parseIncucyteData(file);
    expect(r.wells).toEqual(['B2', 'B3', 'B4']);
    expect(r.timepoints).toEqual([0, 6]);
    expect(r.rawData.B2).toEqual([0, 10]);
  });

  it('still handles a comma export whose preamble mentions Elapsed', () => {
    const csv = [
      'Notes: elapsed times below',
      'Date Time,Elapsed,A1,A2',
      '01/01/2026 00:00,0,5,6',
      '01/01/2026 06:00,6,15,16',
    ].join('\n');
    const r = parseIncucyteData(csv);
    expect(r.wells).toEqual(['A1', 'A2']);
    expect(r.timepoints).toEqual([0, 6]);
  });
});

describe('duplicate and out-of-order elapsed times', () => {
  const dup = [
    'Date Time\tElapsed\t: A1\t: A2',
    'a\t0\t0\t0',
    'b\t24\t10\t10',
    'c\t24\t90\t90',
  ].join('\r\n');

  it('keeps one row per timepoint instead of silently using the first of two', () => {
    const r = parseIncucyteData(dup);
    expect(r.timepoints).toEqual([0, 24]);
    expect(r.rawData.A1).toEqual([0, 10]);
  });

  it('warns that rows were dropped rather than doing it silently', () => {
    const r = parseIncucyteData(dup);
    expect(r.warnings.join(' ')).toMatch(/repeated elapsed time/i);
  });

  it('keeps the endpoint statistic consistent with the visible table', () => {
    const r = parseIncucyteData(dup);
    const res = runAnalysis({
      rawData: r.rawData,
      conditions: [{ id: 1, name: 'C', wells: ['A1', 'A2'] }],
      timepoints: r.timepoints, excludedWells: new Set(),
      outlierMethod: 'none', correctionMethod: 'none',
      selectedTimepoint: 24, controlConditionIdx: 0,
    });
    expect(res.timeCourse.filter(t => t.time === 24)).toHaveLength(1);
    expect(res.statistics.c1.mean).toBe(10);
  });

  it('warns when elapsed times run backwards', () => {
    const r = parseIncucyteData([
      'Date Time\tElapsed\t: A1\t: A2',
      'a\t0\t1\t1',
      'b\t24\t2\t2',
      'c\t12\t3\t3',
    ].join('\r\n'));
    expect(r.warnings.join(' ')).toMatch(/not in increasing order/i);
  });

  it('reports no warnings for a clean file', () => {
    const r = parseIncucyteData([
      'Date Time\tElapsed\t: A1\t: A2',
      'a\t0\t1\t1',
      'b\t12\t2\t2',
    ].join('\r\n'));
    expect(r.warnings).toEqual([]);
  });
});

describe('AUC reports absent rather than zero', () => {
  it('returns null when there is nothing to integrate', () => {
    expect(calculateAUC([], [])).toBeNull();
    expect(calculateAUC([24], [50])).toBeNull();
    expect(calculateAUC(null, null)).toBeNull();
  });

  it('still integrates a real series', () => {
    expect(calculateAUC([0, 12, 24], [0, 20, 40])).toBe(480);
  });

  it('gives a condition with no wells a null AUC, not 0', () => {
    const res = runAnalysis({
      rawData: { A1: [0, 10, 20] },
      conditions: [{ id: 1, name: 'Ctrl', wells: ['A1'] }, { id: 2, name: 'Empty', wells: [] }],
      timepoints: [0, 12, 24], excludedWells: new Set(),
      outlierMethod: 'none', correctionMethod: 'none',
      selectedTimepoint: 24, controlConditionIdx: 0,
    });
    expect(res.auc.c2).toBeNull();
    expect(res.auc.c2_relative).toBeNull();
  });

  it('leaves the AUC cell blank in the CSV instead of writing 0.00', () => {
    const conditions = [
      { id: 1, name: 'Ctrl', color: '#000', wells: ['A1'] },
      { id: 2, name: 'Empty', color: '#111', wells: [] },
    ];
    const res = runAnalysis({
      rawData: { A1: [0, 10, 20] }, conditions,
      timepoints: [0, 12, 24], excludedWells: new Set(),
      outlierMethod: 'none', correctionMethod: 'none',
      selectedTimepoint: 24, controlConditionIdx: 0,
    });
    const csv = buildAnalysisCsv({
      processedData: res, conditions, timepoints: [0, 12, 24],
      rawData: { A1: [0, 10, 20] }, excludedWells: new Set(),
      selectedTimepoint: 24, outlierMethod: 'None', correctionMethod: 'Uncorrected',
      qcReport: {}, keyOf: c => `c${c.id}`,
    });
    const emptyRow = csv.split('\n').find(l => l.startsWith('Empty,'));
    expect(emptyRow).not.toMatch(/,0\.00,/);
  });
});

describe('QC only applies its RWD-calibrated thresholds to percentage metrics', () => {
  // Wound width in microns: 700 -> 100 is a healthy closing wound, but the RWD
  // thresholds call anything above 125 implausible and word it as a percentage.
  const microns = [700, 500, 300, 100];

  it('flags a micron-scale well as out of range when told it is a percentage', () => {
    const r = evaluateWell(microns, [0, 6, 12, 24], { percentMetric: true });
    expect(r.flags.some(f => f.code === 'outOfRange')).toBe(true);
  });

  it('does not flag it when the metric is not a percentage', () => {
    const r = evaluateWell(microns, [0, 6, 12, 24], { percentMetric: false });
    expect(r.flags).toEqual([]);
    expect(r.severity).toBeNull();
  });

  it('still reports genuinely missing data for a non-percentage metric', () => {
    const r = evaluateWell([700, null, 300], [0, 6, 12], { percentMetric: false });
    expect(r.flags.map(f => f.code)).toEqual(['missing']);
  });

  it('still reports an entirely empty well for a non-percentage metric', () => {
    const r = evaluateWell([null, null], [0, 6], { percentMetric: false });
    expect(r.flags.map(f => f.code)).toEqual(['noData']);
  });

  it('skips plate-level scan detection on a non-percentage metric', () => {
    const rawData = { A1: [0, 90, 10], A2: [0, 95, 12] };
    expect(detectScanFailures(['A1', 'A2'], rawData, [0, 6, 12], { percentMetric: false })).toEqual([]);
    expect(detectScanFailures(['A1', 'A2'], rawData, [0, 6, 12]).length).toBeGreaterThan(0);
  });
});

describe('CSV text fields cannot become spreadsheet formulas', () => {
  it('escapes the formula-leading characters', () => {
    expect(sanitizeCsvText('=HYPERLINK("x","y")')).toBe('\'=HYPERLINK("x","y")');
    expect(sanitizeCsvText('+1')).toBe("'+1");
    expect(sanitizeCsvText('-Ctrl')).toBe("'-Ctrl");
    expect(sanitizeCsvText('@SUM')).toBe("'@SUM");
  });

  it('leaves ordinary names alone', () => {
    expect(sanitizeCsvText('Control')).toBe('Control');
    expect(sanitizeCsvText('TGF-b, 10 ng/mL')).toBe('TGF-b, 10 ng/mL');
    expect(sanitizeCsvText(null)).toBe('');
  });

  it('escapes a malicious condition name everywhere it appears in the export', () => {
    const conditions = [{ id: 1, name: '=cmd|calc', color: '#000', wells: ['A1'] }];
    const res = runAnalysis({
      rawData: { A1: [0, 10] }, conditions, timepoints: [0, 24],
      excludedWells: new Set(), outlierMethod: 'none', correctionMethod: 'none',
      selectedTimepoint: 24, controlConditionIdx: 0,
    });
    const csv = buildAnalysisCsv({
      processedData: res, conditions, timepoints: [0, 24],
      rawData: { A1: [0, 10] }, excludedWells: new Set(),
      selectedTimepoint: 24, outlierMethod: 'None', correctionMethod: 'Uncorrected',
      qcReport: {}, keyOf: c => `c${c.id}`,
    });
    // Every occurrence is apostrophe-prefixed; none starts a bare formula.
    expect(csv).not.toMatch(/(^|[,\n])=cmd\|calc/);
    expect(csv).toContain("'=cmd|calc");
  });

  it('does not corrupt negative numbers', () => {
    const conditions = [{ id: 1, name: 'Ctrl', color: '#000', wells: ['A1'] }];
    const res = runAnalysis({
      rawData: { A1: [-5, -10] }, conditions, timepoints: [0, 24],
      excludedWells: new Set(), outlierMethod: 'none', correctionMethod: 'none',
      selectedTimepoint: 24, controlConditionIdx: 0,
    });
    const csv = buildAnalysisCsv({
      processedData: res, conditions, timepoints: [0, 24],
      rawData: { A1: [-5, -10] }, excludedWells: new Set(),
      selectedTimepoint: 24, outlierMethod: 'None', correctionMethod: 'Uncorrected',
      qcReport: {}, keyOf: c => `c${c.id}`,
    });
    expect(csv).toContain('-5.0000');
    expect(csv).not.toContain("'-5.0000");
  });
});

describe('one zero-variance group is still a valid Welch test', () => {
  // Codex read the CLAUDE.md wording as promising testable:false whenever *a*
  // group has zero variance. Welch's t is well defined when only one group is
  // constant (df collapses to the other group's n-1), so discarding it would
  // throw away a real result. The documentation was corrected instead.
  it('tests a comparison where only the control is constant', () => {
    const r = tTest([10, 10, 10], [11, 12, 13]);
    expect(r.testable).toBe(true);
    expect(r.df).toBeCloseTo(2, 6);
    expect(r.p).toBeCloseTo(0.0741799, 5);
  });

  it('refuses only when neither group has any variance', () => {
    expect(tTest([5, 5, 5], [9, 9, 9]).testable).toBe(false);
  });
});
