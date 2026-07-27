import { describe, it, expect } from 'vitest';
import { evaluateWell, evaluateWells, countBySeverity, findSpikes, detectScanFailures, QC_DEFAULTS } from '../qc';

// A well-behaved sigmoid-ish wound closure over 24h.
const HEALTHY = [0, 8, 16, 26, 38, 50, 61, 70, 77, 82, 86, 89, 91];
const TIMES = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

const codes = (r) => r.flags.map(f => f.code);

describe('evaluateWell', () => {
  it('passes a normal healing curve with no flags', () => {
    const r = evaluateWell(HEALTHY, TIMES);
    expect(r.flags).toEqual([]);
    expect(r.severity).toBeNull();
  });

  it('flags the SX5 mask failure: implausibly high RWD two hours in', () => {
    // Taken from a real export — G4 read 90% at t=2h.
    const masked = [0, 90, 88, 91, 89, 92, 90, 91, 93, 90, 92, 91, 90];
    const r = evaluateWell(masked, TIMES);
    expect(codes(r)).toContain('earlyJump');
    expect(r.severity).toBe('high');
    expect(r.flags.find(f => f.code === 'earlyJump').message).toMatch(/2h/);
  });

  it('does not flag a high value that occurs late, when it is genuine healing', () => {
    const r = evaluateWell(HEALTHY, TIMES);
    expect(codes(r)).not.toContain('earlyJump');
  });

  it('never flags the mandatory 0h baseline', () => {
    // A baseline of exactly 0 sits at t=0 and must be exempt from the early check.
    const r = evaluateWell([0, 5, 12, 20, 30, 40, 50, 58, 65, 71, 76, 80, 83], TIMES);
    expect(codes(r)).not.toContain('earlyJump');
  });

  it('flags values outside the physically plausible range', () => {
    const r = evaluateWell([0, 5, 200, 20, 30, 40, 50, 58, 65, 71, 76, 80, 83], TIMES);
    expect(codes(r)).toContain('outOfRange');
    expect(r.severity).toBe('high');
  });

  it('tolerates mildly negative RWD, which is real when a wound widens', () => {
    const r = evaluateWell([0, -3, 4, 14, 26, 38, 49, 59, 68, 74, 79, 83, 86], TIMES);
    expect(codes(r)).not.toContain('outOfRange');
  });

  it('flags a sustained collapse from the running peak', () => {
    const collapsing = [0, 10, 22, 35, 48, 60, 62, 30, 28, 25, 24, 23, 22];
    const r = evaluateWell(collapsing, TIMES);
    expect(codes(r)).toContain('sustainedDrop');
  });

  it('does not call a single-timepoint dropout a sustained collapse', () => {
    // Real pattern from an SX5 export: a clean curve with one dropped frame.
    const oneBadFrame = [0, 4, 10, 21, 31, 43, 0, 60, 69, 75, 82, 87, 90];
    const r = evaluateWell(oneBadFrame, TIMES);
    expect(codes(r)).toContain('spike');
    expect(codes(r)).not.toContain('sustainedDrop');
  });

  it('flags an isolated upward spike and names the timepoint', () => {
    const oneSpike = [0, 4, 7, 11, 14, 83, 21, 25, 28, 30, 32, 34, 36];
    const r = evaluateWell(oneSpike, TIMES);
    expect(codes(r)).toContain('spike');
    expect(r.flags.find(f => f.code === 'spike').message).toMatch(/10h/);
  });

  it('does not mistake a genuinely steep but monotonic segment for a spike', () => {
    // Neighbours disagree strongly with each other, so the midpoint is a real
    // part of the trajectory rather than a lone bad frame.
    const steep = [0, 5, 12, 30, 55, 72, 80, 85, 88, 90, 91, 92, 93];
    expect(codes(evaluateWell(steep, TIMES))).not.toContain('spike');
  });

  it('tolerates plateau jitter without calling it a collapse', () => {
    const jittery = [0, 12, 25, 40, 55, 68, 78, 74, 80, 76, 82, 79, 84];
    expect(codes(evaluateWell(jittery, TIMES))).not.toContain('sustainedDrop');
  });

  it('flags a well that never closes', () => {
    const flat = [0, 0.2, 0.1, 0.4, 0.3, 0.5, 0.2, 0.6, 0.4, 0.3, 0.5, 0.4, 0.5];
    const r = evaluateWell(flat, TIMES);
    expect(codes(r)).toContain('flatline');
    expect(r.severity).toBe('low');
  });

  it('reports missing timepoints as a low-severity flag', () => {
    const gappy = [0, 8, null, 26, 38, 50, 61, 70, 77, 82, 86, 89, 91];
    const r = evaluateWell(gappy, TIMES);
    expect(codes(r)).toContain('missing');
    expect(r.severity).toBe('low');
  });

  it('reports an entirely empty well as high severity', () => {
    const r = evaluateWell([null, null, null], [0, 2, 4]);
    expect(codes(r)).toEqual(['noData']);
    expect(r.severity).toBe('high');
  });

  it('handles undefined input without throwing', () => {
    expect(() => evaluateWell(undefined, undefined)).not.toThrow();
    expect(evaluateWell(undefined, undefined).severity).toBe('high');
  });

  it('escalates to high severity when any single flag is high', () => {
    const both = [0, 90, 88, null, 89, 92, 90, 91, 93, 90, 92, 91, 90];
    const r = evaluateWell(both, TIMES);
    expect(codes(r)).toEqual(expect.arrayContaining(['missing', 'earlyJump']));
    expect(r.severity).toBe('high');
  });

  it('honours threshold overrides', () => {
    const borderline = [0, 45, 55, 62, 70, 75, 80, 84, 87, 89, 90, 91, 92];
    expect(codes(evaluateWell(borderline, TIMES))).toContain('earlyJump');
    expect(codes(evaluateWell(borderline, TIMES, { earlyMaxRwd: 70 }))).not.toContain('earlyJump');
  });

  it('exposes its defaults for callers that want to display them', () => {
    expect(QC_DEFAULTS.earlyMaxRwd).toBe(40);
  });
});

describe('evaluateWells', () => {
  const rawData = {
    A1: HEALTHY,
    A2: [0, 90, 88, 91, 89, 92, 90, 91, 93, 90, 92, 91, 90], // mask failure
    A3: [0, 0.2, 0.1, 0.4, 0.3, 0.5, 0.2, 0.6, 0.4, 0.3, 0.5, 0.4, 0.5], // flatline
  };

  it('omits clean wells so the report is a sparse lookup', () => {
    const report = evaluateWells(['A1', 'A2', 'A3'], rawData, TIMES);
    expect(Object.keys(report).sort()).toEqual(['A2', 'A3']);
  });

  it('counts findings by severity', () => {
    const report = evaluateWells(['A1', 'A2', 'A3'], rawData, TIMES);
    expect(countBySeverity(report)).toEqual({ high: 1, low: 1, total: 2 });
  });

  it('returns empty structures for empty input', () => {
    expect(evaluateWells([], {}, [])).toEqual({});
    expect(countBySeverity({})).toEqual({ high: 0, low: 0, total: 0 });
    expect(countBySeverity(null)).toEqual({ high: 0, low: 0, total: 0 });
  });
});

describe('findSpikes', () => {
  it('skips endpoints, which have no neighbour on one side', () => {
    expect(findSpikes([90, 1, 2, 3, 90], [0, 2, 4, 6, 8], 15)).toEqual([]);
  });

  it('ignores gaps rather than treating null as zero', () => {
    expect(findSpikes([10, null, 12, null, 14], [0, 2, 4, 6, 8], 15)).toEqual([]);
  });
});

describe('detectScanFailures', () => {
  const times = [0, 2, 4, 6, 8, 10, 12];
  const CLEAN = [0, 10, 20, 30, 40, 50, 60];
  const DROPPED_AT_8H = [0, 10, 20, 30, 0, 50, 60];
  // Eight wells; six lost the frame at t=8h.
  const rawData = {};
  ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].forEach(w => { rawData[w] = [...DROPPED_AT_8H]; });
  rawData.A7 = [...CLEAN];
  rawData.A8 = [...CLEAN];
  const wells = Object.keys(rawData);

  it('identifies a timepoint that failed across many wells', () => {
    const failures = detectScanFailures(wells, rawData, times);
    expect(failures).toHaveLength(1);
    expect(failures[0].time).toBe(8);
    expect(failures[0].wells).toBe(6);
    expect(failures[0].fraction).toBeCloseTo(0.75, 5);
  });

  it('stays silent when only a couple of wells are affected', () => {
    const sparse = { A1: [...DROPPED_AT_8H], A2: [...CLEAN], A3: [...CLEAN], A4: [...CLEAN], A5: [...CLEAN] };
    expect(detectScanFailures(Object.keys(sparse), sparse, times)).toEqual([]);
  });

  it('handles empty input', () => {
    expect(detectScanFailures([], {}, times)).toEqual([]);
  });
});
