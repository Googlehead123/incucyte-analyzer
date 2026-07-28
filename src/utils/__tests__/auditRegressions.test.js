// Regression guards for the correctness audit.
//
// Every case here is a defect that was live in the app and produced a plausible
// but wrong number or picture. They are grouped by the defect rather than by the
// module so the reason each assertion exists stays legible.

import { describe, it, expect } from 'vitest';
import { parseIncucyteData, calculateStats, tTest, isPercentMetric } from '../statistics';
import { runAnalysis } from '../analysis';
import { buildAnalysisCsv } from '../exportCsv';

const tabExport = (notes, metric = 'Metric: Relative Wound Density (Percent)') =>
  [
    'Label: ',
    metric,
    'Cell Type: ',
    notes,
    'Analysis Job: CAVIAR',
    '',
    'Date Time\tElapsed\t: B2\t: B3\t: B4',
    '2026-03-04 06:31:00\t0\t0\t0\t0',
    '2026-03-04 09:31:00\t3\t10.5\t11.2\t9.8',
    '2026-03-04 12:31:00\t6\t22.1\t23.4\t20.9',
  ].join('\r\n');

describe('free text in the metadata preamble cannot pick the delimiter', () => {
  // A `Notes:` value with three commas used to make a tab-separated export parse
  // as CSV. It produced one well column and zero data rows, and the app rejected
  // a perfectly valid file with "contains no data rows".
  it('parses a tab export whose Notes field is full of commas', () => {
    const r = parseIncucyteData(tabExport('Notes: plate 1, rep 2, seeded 5k/well, T75'));
    expect(r.wells).toEqual(['B2', 'B3', 'B4']);
    expect(r.timepoints).toEqual([0, 3, 6]);
    expect(r.rawData.B2).toEqual([0, 10.5, 22.1]);
  });

  it('agrees with the same file when the Notes field is empty', () => {
    const dirty = parseIncucyteData(tabExport('Notes: a, b, c, d, e'));
    const clean = parseIncucyteData(tabExport('Notes: '));
    expect(dirty.wells).toEqual(clean.wells);
    expect(dirty.rawData).toEqual(clean.rawData);
  });

  it('is not fooled by commas in the Label or Analysis Job either', () => {
    const r = parseIncucyteData(tabExport('Label: run A, run B, run C'));
    expect(r.wells).toEqual(['B2', 'B3', 'B4']);
  });

  it('still parses a genuine comma-separated export', () => {
    const csv = [
      'Date Time,Elapsed,A1 : Relative Wound Density (%),A2 : Relative Wound Density (%)',
      '01/01/2026 00:00,0,5.2,4.8',
      '01/01/2026 06:00,6,15.3,14.1',
    ].join('\n');
    const r = parseIncucyteData(csv);
    expect(r.wells).toEqual(['A1', 'A2']);
    expect(r.rawData.A1).toEqual([5.2, 15.3]);
  });

  it('still rejects a file with no recognisable header', () => {
    expect(() => parseIncucyteData('Label: x\nNotes: y\nnothing here')).toThrow(/header row/i);
  });
});

describe('the exported Metric drives the axis label', () => {
  // The label was hardcoded to RWD, so a Wound Confluence export plotted
  // correctly but asserted the wrong measurement on the figure.
  it('reads the Metric header and tidies (Percent) to (%)', () => {
    const r = parseIncucyteData(tabExport('Notes: '));
    expect(r.metric).toBe('Relative Wound Density (%)');
  });

  it('reports a different metric rather than defaulting to RWD', () => {
    const r = parseIncucyteData(tabExport('Notes: ', 'Metric: Wound Confluence (Percent)'));
    expect(r.metric).toBe('Wound Confluence (%)');
  });

  it('returns null when the export carries no Metric line', () => {
    const csv = ['Date Time,Elapsed,A1,A2', '01/01/2026,0,1,2'].join('\n');
    expect(parseIncucyteData(csv).metric).toBeNull();
  });

  it('classifies percentage metrics so a 0-100 axis is only used where it applies', () => {
    expect(isPercentMetric('Relative Wound Density (%)')).toBe(true);
    expect(isPercentMetric('Wound Confluence (Percent)')).toBe(true);
    expect(isPercentMetric('Wound Width (µm)')).toBe(false);
    expect(isPercentMetric(null)).toBe(true); // unknown: keep the previous default
  });
});

describe('absent measurements are never reported as zero', () => {
  it('gives a null mean for an empty set, not 0', () => {
    expect(calculateStats([])).toMatchObject({ mean: null, sd: null, sem: null, n: 0 });
  });

  it('gives a null SD for a single replicate, since it is undefined', () => {
    expect(calculateStats([42])).toMatchObject({ mean: 42, sd: null, sem: null, n: 1 });
  });

  it('still computes normally with two or more replicates', () => {
    const s = calculateStats([10, 20]);
    expect(s.mean).toBe(15);
    expect(s.sd).toBeCloseTo(7.0710678, 6);
    expect(s.sem).toBeCloseTo(5, 6);
  });

  it('leaves a gap in the time course when a frame is lost for every well', () => {
    const res = runAnalysis({
      rawData: { A1: [0, null, 20], A2: [0, null, 22] },
      conditions: [{ id: 1, name: 'Ctrl', wells: ['A1', 'A2'] }],
      timepoints: [0, 12, 24],
      excludedWells: new Set(),
      outlierMethod: 'none', correctionMethod: 'none',
      selectedTimepoint: 24, controlConditionIdx: 0,
    });
    // Was [0, 0, 21]: the lost 12h frame drew a crash to the baseline and back.
    expect(res.timeCourse.map(r => r.c1_mean)).toEqual([0, null, 21]);
    expect(res.timeCourse.map(r => r.c1_n)).toEqual([2, 0, 2]);
  });

  it('does not draw a condition that has no wells assigned', () => {
    const res = runAnalysis({
      rawData: { A1: [0, 10, 20], A2: [0, 12, 22] },
      conditions: [
        { id: 1, name: 'Control', wells: ['A1', 'A2'] },
        { id: 2, name: 'Treatment', wells: [] },
      ],
      timepoints: [0, 12, 24],
      excludedWells: new Set(),
      outlierMethod: 'none', correctionMethod: 'none',
      selectedTimepoint: 24, controlConditionIdx: 0,
    });
    expect(res.timeCourse.map(r => r.c2_mean)).toEqual([null, null, null]);
    expect(res.statistics.c2.mean).toBeNull();
  });

  it('writes blanks, not zeros, into the exported CSV for those gaps', () => {
    const conditions = [{ id: 1, name: 'Ctrl', color: '#000', wells: ['A1'] }];
    const res = runAnalysis({
      rawData: { A1: [0, null, 20] },
      conditions, timepoints: [0, 12, 24], excludedWells: new Set(),
      outlierMethod: 'none', correctionMethod: 'none',
      selectedTimepoint: 24, controlConditionIdx: 0,
    });
    const csv = buildAnalysisCsv({
      processedData: res, conditions, timepoints: [0, 12, 24],
      rawData: { A1: [0, null, 20] }, excludedWells: new Set(),
      selectedTimepoint: 24, outlierMethod: 'None', correctionMethod: 'Uncorrected',
      qcReport: {}, keyOf: c => `c${c.id}`,
    });
    const timeCourse = csv.slice(0, csv.indexOf('Endpoint Statistics'));
    // The 12h row carries no fabricated 0.0000 for the mean.
    expect(timeCourse).toMatch(/\n12,,,,0\n/);
  });
});

describe('untestable comparisons stay out of the correction family', () => {
  it('marks a comparison with too few replicates as not testable', () => {
    const r = tTest([1, 2, 3], [5]);
    expect(r.testable).toBe(false);
    expect(r.p).toBeNull();
    expect(r.stars).toBe('n/a');
  });

  it('marks a zero-variance comparison as not testable rather than p=1', () => {
    const r = tTest([5, 5, 5], [9, 9, 9]);
    expect(r.testable).toBe(false);
    expect(r.p).toBeNull();
  });

  it('reports a real comparison as testable', () => {
    const r = tTest([1, 2, 3], [10, 11, 12]);
    expect(r.testable).toBe(true);
    expect(r.p).toBeLessThan(0.05);
  });

  it('does not let an unassigned condition weaken the real comparisons', () => {
    const base = {
      rawData: { A1: [0, 10], A2: [0, 12], B1: [0, 30], B2: [0, 33] },
      timepoints: [0, 24],
      excludedWells: new Set(),
      outlierMethod: 'none', correctionMethod: 'holmSidak',
      selectedTimepoint: 24, controlConditionIdx: 0,
    };
    const withoutGhost = runAnalysis({
      ...base,
      conditions: [
        { id: 1, name: 'Control', wells: ['A1', 'A2'] },
        { id: 2, name: 'Drug', wells: ['B1', 'B2'] },
      ],
    });
    const withGhost = runAnalysis({
      ...base,
      conditions: [
        { id: 1, name: 'Control', wells: ['A1', 'A2'] },
        { id: 2, name: 'Drug', wells: ['B1', 'B2'] },
        { id: 3, name: 'Forgot to assign', wells: [] },
      ],
    });
    expect(withGhost.comparisonCount).toBe(1);
    expect(withGhost.untestedCount).toBe(1);
    // The real drug comparison is unchanged by the empty condition beside it.
    expect(withGhost.pValues.c2.p).toBeCloseTo(withoutGhost.pValues.c2.p, 12);
    expect(withGhost.pValues.c3).toMatchObject({ testable: false, stars: 'n/a', p: null });
  });
});
