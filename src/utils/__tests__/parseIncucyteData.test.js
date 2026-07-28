import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseIncucyteData, isPercentMetric } from '../statistics.js';
import { runAnalysis } from '../analysis.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name) => readFileSync(join(fixturesDir, name), 'utf8');

describe('parseIncucyteData — real Incucyte exports', () => {
  // Regression: an Analysis Job name like "PLATE1_2" contains the substring "E1",
  // which the old /[A-H]\d+/ header heuristic matched, hijacking the metadata line
  // as the header and yielding zero wells. This file MUST parse correctly.
  it('parses a file whose job name collides with the well regex (PLATE1_2)', () => {
    const { wells, timepoints, rawData } = parseIncucyteData(fixture('plate1_2_jobname_collision.txt'));
    // 6 rows (B–G) × 12 columns = 72 wells, Std Err columns excluded.
    expect(wells).toHaveLength(72);
    expect(wells).toContain('B1');
    expect(wells).toContain('G12');
    expect(timepoints.length).toBeGreaterThan(0);
    expect(rawData['B1']).toHaveLength(timepoints.length);
    // Two-digit columns must be distinct from single-digit ones.
    expect(wells).toContain('B1');
    expect(wells).toContain('B10');
    expect(wells.filter((w) => w === 'B1')).toHaveLength(1);
  });

  it('parses the single-digit-column sibling file (PLATE2)', () => {
    const { wells, timepoints } = parseIncucyteData(fixture('plate2_single_digit_cols.txt'));
    // 6 rows × 9 columns = 54 wells.
    expect(wells).toHaveLength(54);
    expect(wells).toContain('G9');
    expect(wells).not.toContain('G10');
    expect(timepoints.length).toBeGreaterThan(0);
  });

  it('parses a metadata-header export with multi-digit columns (B2–B11)', () => {
    const { wells } = parseIncucyteData(fixture('metadata_header_multidigit.txt'));
    expect(wells).toContain('B10');
    expect(wells).toContain('B11');
    expect(wells.length).toBeGreaterThan(0);
  });

  it('parses a CSV export with metric-suffixed headers', () => {
    const { wells, timepoints } = parseIncucyteData(fixture('csv_metric_suffix.csv'));
    expect(wells).toEqual(['A1', 'A2', 'A3', 'B1', 'B2', 'B3']);
    expect(timepoints).toEqual([0, 6, 12, 18, 24]);
  });

  it('parses a simple tab-delimited file', () => {
    const { wells } = parseIncucyteData(fixture('simple_tab.txt'));
    expect(wells).toEqual(['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4']);
  });

  // The metric-label work was previously only covered by synthetic files. This is a
  // real Wound Confluence export off the instrument — the case that used to plot
  // correctly but be labelled "Relative Wound Density".
  it('reads the metric from a real Wound Confluence export', () => {
    const { metric, wells, timepoints, warnings } = parseIncucyteData(fixture('wound_confluence_metric.txt'));
    expect(metric).toBe('Wound Confluence (%)');
    expect(isPercentMetric(metric)).toBe(true);
    expect(wells).toContain('B2');
    expect(timepoints).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(warnings).toEqual([]);
  });

  it('parses a full 24h run at 2h intervals and reports it as RWD', () => {
    const { metric, timepoints, rawData, wells, warnings } = parseIncucyteData(fixture('rwd_full_run_2h_intervals.txt'));
    expect(metric).toBe('Relative Wound Density (%)');
    expect(timepoints).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    // Every well series stays aligned to the timepoint axis.
    wells.forEach(w => expect(rawData[w]).toHaveLength(timepoints.length));
    expect(warnings).toEqual([]);
  });

  it('carries a real export through the full analysis without fabricating values', () => {
    const { rawData, timepoints } = parseIncucyteData(fixture('rwd_full_run_2h_intervals.txt'));
    const results = runAnalysis({
      rawData,
      conditions: [
        { id: 1, name: 'Control', wells: ['B2', 'B3', 'B4'] },
        { id: 2, name: 'Treated', wells: ['C2', 'C3', 'C4'] },
      ],
      timepoints,
      excludedWells: new Set(),
      outlierMethod: 'none',
      correctionMethod: 'holmSidak',
      selectedTimepoint: 24,
      controlConditionIdx: 0,
    });
    // Real data: every timepoint measured, so no nulls and no fabricated zeros.
    expect(results.timeCourse).toHaveLength(13);
    results.timeCourse.forEach(row => {
      expect(typeof row.c1_mean).toBe('number');
      expect(row.c1_n).toBe(3);
    });
    expect(results.statistics.c1.n).toBe(3);
    expect(typeof results.auc.c1).toBe('number');
    expect(results.auc.c1).toBeGreaterThan(0);
    expect(results.pValues.c2.testable).toBe(true);
    expect(results.comparisonCount).toBe(1);
  });
});

describe('parseIncucyteData — header detection robustness', () => {
  // Synthetic version of the PLATE1_2 collision, minimal and self-contained.
  it('does not treat a metadata line containing a stray well-like token as the header', () => {
    const text = [
      'Analysis Job: PLATE1_2', // contains "E1"
      'Notes: sample G9 prepared', // contains "G9"
      'Date Time\tElapsed\t: B1\t: B2\t: B10',
      '2026-01-01 00:00\t0\t1.1\t2.2\t3.3',
      '2026-01-01 06:00\t6\t4.4\t5.5\t6.6',
    ].join('\n');
    const { wells, timepoints } = parseIncucyteData(text);
    expect(wells).toEqual(['B1', 'B2', 'B10']);
    expect(timepoints).toEqual([0, 6]);
  });

  it('throws a clear error when no header can be found', () => {
    expect(() => parseIncucyteData('just some\nrandom text\nwith no columns')).toThrow(/header row/i);
  });

  it('throws a clear error when the header has no well columns', () => {
    // "Elapsed" present but no well columns at all.
    const text = 'Date Time\tElapsed\tNotApplicable\n2026-01-01 00:00\t0\t5';
    expect(() => parseIncucyteData(text)).toThrow(/well columns/i);
  });
});
