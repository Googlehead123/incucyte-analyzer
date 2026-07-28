import jStat from 'jstat';

/**
 * Descriptive stats for one set of well readings.
 *
 * Absent quantities are `null`, never 0. "No wells reported a value here" and
 * "the wound density was 0%" are different claims, and returning 0 for the first
 * made the chart draw a measured-looking point on the baseline. Likewise a single
 * well has no sample SD — it needs n-1 degrees of freedom — so reporting 0 drew a
 * ±0.00 error bar implying perfect precision.
 *
 * @returns {{mean: number|null, sd: number|null, sem: number|null, n: number, values: number[]}}
 */
export const calculateStats = (values) => {
  const filtered = (values || []).filter(v => v !== null && v !== undefined && !isNaN(v));
  const n = filtered.length;
  if (n === 0) return { mean: null, sd: null, sem: null, n: 0, values: [] };

  const mean = filtered.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { mean, sd: null, sem: null, n, values: filtered };

  const variance = filtered.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
  const sd = Math.sqrt(variance);
  return { mean, sd, sem: sd / Math.sqrt(n), n, values: filtered };
};

/**
 * Welch's two-tailed t-test.
 *
 * `testable` distinguishes "tested, found no difference" from "could not be
 * tested". Both used to report p=1, which let an unassigned or single-well
 * condition enter the multiple-comparison family and weaken every real
 * comparison alongside it.
 */
export const tTest = (group1, group2) => {
  const stats1 = calculateStats(group1);
  const stats2 = calculateStats(group2);

  const untestable = (reason) => ({
    t: null, p: null, df: null, significant: false, stars: 'n/a', testable: false, reason,
  });

  if (stats1.n < 2 || stats2.n < 2) {
    return untestable('needs at least 2 replicates per group');
  }

  const n1 = stats1.n, n2 = stats2.n;
  const m1 = stats1.mean, m2 = stats2.mean;
  const v1 = stats1.sd * stats1.sd, v2 = stats2.sd * stats2.sd;

  const se = Math.sqrt(v1/n1 + v2/n2);
  if (se === 0) {
    // Both groups are perfectly constant. There is no variance to test against,
    // so the comparison is undefined rather than non-significant.
    return untestable('zero variance in both groups');
  }

  const tStat = (m1 - m2) / se;
  const df = Math.pow(v1/n1 + v2/n2, 2) / (Math.pow(v1/n1, 2)/(n1-1) + Math.pow(v2/n2, 2)/(n2-1));

  // Two-tailed p-value using jstat's t-distribution CDF
  const p = 2 * jStat.studentt.cdf(-Math.abs(tStat), df);

  return {
    t: tStat, p, df,
    significant: p < 0.05,
    stars: p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns',
    testable: true,
  };
};

/**
 * Trapezoid area under the curve, or null when there is nothing to integrate.
 *
 * Returning 0 for "fewer than two measured points" made an unassigned condition,
 * or one whose wells were all excluded, report a confident AUC of 0.0 next to
 * conditions with real areas.
 */
export const calculateAUC = (timepoints, values) => {
  if (!timepoints || !values) return null;
  if (timepoints.length < 2 || values.length < 2) return null;
  let auc = 0;
  for (let i = 1; i < timepoints.length; i++) {
    const dt = timepoints[i] - timepoints[i-1];
    const avgValue = (values[i] + values[i-1]) / 2;
    auc += dt * avgValue;
  }
  return auc;
};

export const removeMinMax = (values) => {
  const filtered = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (filtered.length <= 2) return filtered;
  const sorted = [...filtered].sort((a, b) => a - b);
  return sorted.slice(1, -1);
};

export const selectBestTriplicate = (wells, rawData, timeIdx) => {
  if (wells.length <= 3) return wells;
  const validWells = wells.filter(w => {
    const v = rawData[w]?.[timeIdx];
    return v !== null && v !== undefined && !isNaN(v);
  });
  if (validWells.length <= 3) return validWells;

  let bestCombo = validWells.slice(0, 3);
  let bestVariance = Infinity;

  for (let i = 0; i < validWells.length - 2; i++) {
    for (let j = i + 1; j < validWells.length - 1; j++) {
      for (let k = j + 1; k < validWells.length; k++) {
        const vals = [
          rawData[validWells[i]][timeIdx],
          rawData[validWells[j]][timeIdx],
          rawData[validWells[k]][timeIdx]
        ];
        const mean = (vals[0] + vals[1] + vals[2]) / 3;
        const variance = (Math.pow(vals[0] - mean, 2) + Math.pow(vals[1] - mean, 2) + Math.pow(vals[2] - mean, 2)) / 2;
        if (variance < bestVariance) {
          bestVariance = variance;
          bestCombo = [validWells[i], validWells[j], validWells[k]];
        }
      }
    }
  }
  return bestCombo;
};

// Match well names in a header field, handling various Incucyte export formats:
//   "A1", "A01", "A1 : Relative Wound Density (%)", ": B2", ": B2 (Std Err)", ": G12"
// The well token must be anchored to the start of the field or follow a "<colname>:"
// separator — this prevents matching stray substrings such as the "E1" inside a job
// name like "PLATE1_2", which previously hijacked header detection.
const WELL_PATTERN = /(?:^|:\s*)([A-H])(\d+)/;
const STD_ERR_PATTERN = /\(Std Err\)/i;
const ELAPSED_PATTERN = /elapsed/i;

const DELIMITERS = ['\t', ','];

/** How many lines below `headerIndex` parse as data rows under this delimiter. */
const countDataRows = (lines, headerIndex, delimiter, timeColIdx) => {
  let n = 0;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter);
    if (values.length < 3) continue;
    if (!Number.isNaN(parseFloat(values[timeColIdx]))) n += 1;
  }
  return n;
};

/**
 * Ranking for header candidates. Whether the candidate actually has data under it
 * dominates everything else: a header with no rows beneath it is not a header,
 * however convincing the line looks on its own.
 */
const betterHeader = (a, b) => {
  if (!b) return true;
  const aHas = a.dataRows > 0, bHas = b.dataRows > 0;
  if (aHas !== bHas) return aHas;
  if (a.tier !== b.tier) return a.tier > b.tier;
  return a.wellCount > b.wellCount;
};

/**
 * Best header-row candidate in `lines` when split by `delimiter`, or null.
 *
 * Scored in tiers so the canonical export always wins over a coincidence:
 *   3 — an `Elapsed` column and at least one well column: the real Incucyte header
 *   2 — at least two well columns: a non-standard export with no Elapsed column
 *   1 — an `Elapsed` column alone: last resort, shape unrecognised
 *
 * Tiers alone are not enough. A `Notes:` line reading "bad scan at Elapsed, A1,
 * A2, A3, A4" splits on commas into an Elapsed field plus four well-shaped
 * fields, scoring tier 3 with a higher well count than the genuine tab header.
 * Requiring parseable data rows underneath is what settles it: prose has none.
 *
 * A line that splits into fewer than two fields is skipped — under the wrong
 * delimiter a whole row collapses into one field, which is what lets the caller
 * tell tab-separated and comma-separated files apart.
 */
const findHeaderRow = (lines, delimiter) => {
  let best = null;
  for (let i = 0; i < lines.length; i++) {
    const fields = lines[i].split(delimiter).map(f => f.trim());
    if (fields.length < 2) continue;

    const wellCount = fields.filter(f => !STD_ERR_PATTERN.test(f) && WELL_PATTERN.test(f)).length;
    const elapsedIdx = fields.findIndex(f => ELAPSED_PATTERN.test(f));
    const hasElapsed = elapsedIdx >= 0;
    const tier = hasElapsed && wellCount >= 1 ? 3 : wellCount >= 2 ? 2 : hasElapsed ? 1 : 0;
    if (tier === 0) continue;

    const timeColIdx = hasElapsed ? elapsedIdx : 1;
    const candidate = {
      index: i, tier, wellCount, delimiter, timeColIdx,
      dataRows: countDataRows(lines, i, delimiter, timeColIdx),
    };
    if (betterHeader(candidate, best)) best = candidate;

    // A canonical header with real data under it is unambiguous — stop, so a
    // later data row can never outscore it.
    if (tier === 3 && candidate.dataRows > 0) break;
  }
  return best;
};

/**
 * `Metric: Relative Wound Density (Percent)` from the preamble, tidied for use as
 * an axis label. Returns null when the export carries no Metric line.
 */
const extractMetric = (lines, headerIndex) => {
  for (let i = 0; i < headerIndex; i++) {
    const m = lines[i].match(/^\s*Metric\s*:\s*(.+?)\s*$/i);
    if (m && m[1]) return m[1].replace(/\(\s*percent\s*\)/i, '(%)');
  }
  return null;
};

/** True when the metric is a percentage, so a 0-100 axis is the right full scale. */
export const isPercentMetric = (metric) =>
  metric == null ? true : /%|percent/i.test(metric);

export const parseIncucyteData = (text) => {
  const lines = text.split('\n').filter(line => line.trim());

  // Delimiter and header row are resolved together. Scoring each delimiter by the
  // header it can actually find is what stops free-text metadata from deciding the
  // format: a `Notes:` value with three commas used to make a tab-separated export
  // parse as CSV, which yielded one well column and no data rows at all.
  const header = DELIMITERS
    .map(d => findHeaderRow(lines, d))
    .filter(Boolean)
    .reduce((best, c) => (betterHeader(c, best) ? c : best), null);

  if (!header) {
    throw new Error('Could not find a data header row (no "Elapsed" column or well columns detected). Is this a valid Incucyte export?');
  }

  const { delimiter, index: headerIndex } = header;
  const wellPattern = WELL_PATTERN;
  const stdErrPattern = STD_ERR_PATTERN;
  const metric = extractMetric(lines, headerIndex);

  const headers = lines[headerIndex].split(delimiter).map(h => h.trim());

  const elapsedIdx = headers.findIndex(h => /elapsed/i.test(h));
  const timeColIdx = elapsedIdx >= 0 ? elapsedIdx : 1;

  // Extract well columns. Skip Std Err columns — only keep the first (data) column per well.
  const wells = [];
  const wellIndices = {};

  headers.forEach((header, idx) => {
    if (stdErrPattern.test(header)) return;
    const match = header.match(wellPattern);
    if (match) {
      const wellName = `${match[1]}${parseInt(match[2], 10)}`;
      if (!wells.includes(wellName)) {
        wells.push(wellName);
        wellIndices[wellName] = idx;
      }
    }
  });

  if (wells.length === 0) {
    throw new Error('No well columns found in the header row. The file may not be a supported Incucyte export.');
  }

  const timepoints = [];
  const rawData = {};
  const warnings = [];
  wells.forEach(well => { rawData[well] = []; });

  // A repeated elapsed value is a corrupt export. Keeping both rows was worse than
  // dropping one: the endpoint picker showed two identical options and analysis
  // resolved the endpoint with findIndex, so it always silently used the first —
  // a plate could report 10% at 24h while the table below showed 90% at 24h.
  const seenElapsed = new Set();
  const duplicates = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter);
    if (values.length < 3) continue;
    const elapsed = parseFloat(values[timeColIdx]);
    if (isNaN(elapsed)) continue;
    if (seenElapsed.has(elapsed)) {
      duplicates.push(elapsed);
      continue;
    }
    seenElapsed.add(elapsed);
    timepoints.push(elapsed);
    wells.forEach(well => {
      const idx = wellIndices[well];
      const value = parseFloat(values[idx]);
      rawData[well].push(isNaN(value) ? null : value);
    });
  }

  if (duplicates.length) {
    const shown = [...new Set(duplicates)].slice(0, 5).join('h, ');
    warnings.push(
      `Dropped ${duplicates.length} row${duplicates.length > 1 ? 's' : ''} with a repeated elapsed time ` +
      `(${shown}h${new Set(duplicates).size > 5 ? ', …' : ''}). The first row for each timepoint was kept — ` +
      `check the export, since a duplicate timepoint usually means the file is truncated or concatenated.`
    );
  }

  // Elapsed times that go backwards would make the time axis and the trapezoid
  // AUC meaningless, so say so rather than plotting a zigzag.
  const outOfOrder = timepoints.some((t, i) => i > 0 && t < timepoints[i - 1]);
  if (outOfOrder) {
    warnings.push('Elapsed times are not in increasing order. The chart and the AUC follow file order, so check the export.');
  }

  return { wells, timepoints, rawData, metric, warnings };
};
