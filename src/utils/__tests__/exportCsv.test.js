import { describe, it, expect } from 'vitest';
import { csvField, csvRow, buildAnalysisCsv } from '../exportCsv';

describe('csvField', () => {
  it('leaves plain values untouched', () => {
    expect(csvField('Control')).toBe('Control');
    expect(csvField(12.5)).toBe('12.5');
  });

  it('quotes fields containing a comma', () => {
    expect(csvField('TGF-b, 10 ng/mL')).toBe('"TGF-b, 10 ng/mL"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    expect(csvField('a "quoted" name')).toBe('"a ""quoted"" name"');
  });

  it('quotes fields containing newlines', () => {
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    expect(csvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('renders null and undefined as empty', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });
});

describe('csvRow', () => {
  it('keeps column count stable when a name contains a comma', () => {
    const row = csvRow(['Time', 'TGF-b, 10 ng/mL Mean', 'TGF-b, 10 ng/mL SD']);
    // Naive splitting is what the old exporter effectively did; a correct row
    // must still be parseable back into exactly 3 fields.
    expect(parseCsvLine(row)).toHaveLength(3);
    expect(parseCsvLine(row)[1]).toBe('TGF-b, 10 ng/mL Mean');
  });
});

// Minimal RFC-4180 reader, used to prove the writer round-trips.
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

describe('buildAnalysisCsv', () => {
  const keyOf = (c) => `c${c.id}`;
  const conditions = [
    { id: 1, name: 'Control', wells: ['A1', 'A2'] },
    { id: 2, name: 'TGF-b, 10 ng/mL', wells: ['B1', 'B2'] },
  ];
  const timepoints = [0, 12, 24];
  const rawData = {
    A1: [0, 20, 40], A2: [0, 22, 44],
    B1: [0, 30, 60], B2: [0, 32, 64],
  };
  const processedData = {
    controlKey: 'c1',
    controlName: 'Control',
    correctionMethod: 'Holm-Sidak',
    comparisonCount: 1,
    timeCourse: [
      { time: 0, c1_mean: 0, c1_sd: 0, c1_sem: 0, c1_n: 2, c2_mean: 0, c2_sd: 0, c2_sem: 0, c2_n: 2 },
      { time: 12, c1_mean: 21, c1_sd: 1.41, c1_sem: 1, c1_n: 2, c2_mean: 31, c2_sd: 1.41, c2_sem: 1, c2_n: 2 },
      { time: 24, c1_mean: 42, c1_sd: 2.83, c1_sem: 2, c1_n: 2, c2_mean: 62, c2_sd: 2.83, c2_sem: 2, c2_n: 2 },
    ],
    statistics: {
      c1: { mean: 42, sd: 2.83, sem: 2, n: 2 },
      c2: { mean: 62, sd: 2.83, sem: 2, n: 2 },
    },
    pValues: {
      c1: { p: null, pRaw: null, stars: '-' },
      c2: { p: 0.02, pRaw: 0.02, stars: '*' },
    },
    auc: { c1: 504, c2: 744, c1_relative: '100.0', c2_relative: '147.6' },
    representativeWells: {
      c1: [{ well: 'A1', value: 40 }],
      c2: [{ well: 'B2', value: 64 }],
    },
  };

  const build = (overrides = {}) => buildAnalysisCsv({
    processedData, conditions, timepoints, rawData,
    excludedWells: new Set(),
    selectedTimepoint: 24,
    outlierMethod: 'None',
    correctionMethod: 'Holm-Sidak',
    qcReport: {},
    keyOf,
    ...overrides,
  });

  it('keeps the time-course header parseable despite a comma in a condition name', () => {
    const header = build().split('\n')[0];
    const fields = parseCsvLine(header);
    // 1 time column + 4 columns per condition
    expect(fields).toHaveLength(9);
    expect(fields[5]).toBe('TGF-b, 10 ng/mL Mean');
  });

  it('resolves values by condition id, so duplicate names do not collide', () => {
    const dupes = [
      { id: 1, name: 'Same', wells: ['A1'] },
      { id: 2, name: 'Same', wells: ['B1'] },
    ];
    const rows = build({ conditions: dupes }).split('\n');
    const t24 = parseCsvLine(rows[3]);
    expect(t24[0]).toBe('24');
    expect(t24[1]).toBe('42.0000'); // condition id 1
    expect(t24[5]).toBe('62.0000'); // condition id 2 — distinct, not overwritten
  });

  it('records both raw and adjusted p-values', () => {
    const csv = build();
    const line = csv.split('\n').find(l => l.startsWith('"TGF-b'));
    const f = parseCsvLine(line);
    expect(f[5]).toBe('0.0200'); // raw
    expect(f[6]).toBe('0.0200'); // adjusted
    expect(f[7]).toBe('*');
  });

  it('writes method provenance so a figure can be traced back', () => {
    const csv = build();
    expect(csv).toContain('Multiple-comparison correction,Holm-Sidak');
    expect(csv).toContain("Welch's t-test");
    expect(csv).toContain('Endpoint timepoint (h),24');
  });

  it('adds an explicit caution when Best Triplicate was used', () => {
    const csv = build({ outlierMethod: 'Best Triplicate' });
    expect(csv).toMatch(/anti-conservative/);
  });

  it('omits the caution otherwise', () => {
    expect(build()).not.toMatch(/anti-conservative/);
  });

  it('includes a QC section when wells were flagged', () => {
    const csv = build({
      qcReport: { B1: { severity: 'high', flags: [{ code: 'earlyJump', message: 'Reads 90% at 2h' }] } },
    });
    expect(csv).toContain('Quality-Control Flags');
    expect(csv).toContain('Reads 90% at 2h');
  });

  it('omits the QC section entirely when nothing was flagged', () => {
    expect(build()).not.toContain('Quality-Control Flags');
  });

  it('excludes excluded wells from the raw per-well dump', () => {
    const csv = build({ excludedWells: new Set(['A2']) });
    const rawSection = csv.slice(csv.indexOf('Raw Well Data'));
    expect(rawSection).toContain('A1');
    expect(rawSection).not.toContain('A2');
  });

  it('emits a trailing newline and no undefined leakage', () => {
    const csv = build();
    expect(csv.endsWith('\n')).toBe(true);
    expect(csv).not.toContain('undefined');
    expect(csv).not.toContain('NaN');
  });
});
