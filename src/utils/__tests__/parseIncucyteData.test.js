import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseIncucyteData } from '../statistics.js';

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
