import jStat from 'jstat';

export const calculateStats = (values) => {
  const filtered = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (filtered.length === 0) return { mean: 0, sd: 0, sem: 0, n: 0, values: [] };
  const n = filtered.length;
  const mean = filtered.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? filtered.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const sem = n > 0 ? sd / Math.sqrt(n) : 0;
  return { mean, sd, sem, n, values: filtered };
};

export const tTest = (group1, group2) => {
  const stats1 = calculateStats(group1);
  const stats2 = calculateStats(group2);

  if (stats1.n < 2 || stats2.n < 2) return { t: 0, p: 1, df: 0, significant: false, stars: 'ns' };

  const n1 = stats1.n, n2 = stats2.n;
  const m1 = stats1.mean, m2 = stats2.mean;
  const v1 = stats1.sd * stats1.sd, v2 = stats2.sd * stats2.sd;

  const se = Math.sqrt(v1/n1 + v2/n2);
  if (se === 0) return { t: 0, p: 1, df: 0, significant: false, stars: 'ns' };

  const tStat = (m1 - m2) / se;
  const df = Math.pow(v1/n1 + v2/n2, 2) / (Math.pow(v1/n1, 2)/(n1-1) + Math.pow(v2/n2, 2)/(n2-1));

  // Two-tailed p-value using jstat's t-distribution CDF
  const p = 2 * jStat.studentt.cdf(-Math.abs(tStat), df);

  return {
    t: tStat, p, df,
    significant: p < 0.05,
    stars: p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns'
  };
};

export const calculateAUC = (timepoints, values) => {
  if (timepoints.length < 2 || values.length < 2) return 0;
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

export const parseIncucyteData = (text) => {
  const lines = text.split('\n').filter(line => line.trim());

  // Auto-detect delimiter: tab vs comma
  // Check which delimiter produces more columns on the first few lines
  const detectDelimiter = (lines) => {
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const tabCount = (lines[i].match(/\t/g) || []).length;
      const commaCount = (lines[i].match(/,/g) || []).length;
      if (tabCount > 2 || commaCount > 2) {
        return tabCount >= commaCount ? '\t' : ',';
      }
    }
    return '\t';
  };
  const delimiter = detectDelimiter(lines);

  let headerIndex = -1;
  let headers = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Elapsed') || lines[i].match(/[A-H]\d+/)) {
      headerIndex = i;
      headers = lines[i].split(delimiter).map(h => h.trim());
      break;
    }
  }

  if (headerIndex === -1) throw new Error('Could not find header row');

  const elapsedIdx = headers.findIndex(h => /elapsed/i.test(h));
  const timeColIdx = elapsedIdx >= 0 ? elapsedIdx : 1;

  // Match well names in headers, handling various Incucyte export formats:
  //   "A1", "A01", "A1 : Relative Wound Density (%)", ": B2", ": B2 (Std Err)"
  // Skip Std Err columns — only keep the first (data) column per well.
  const wellPattern = /(?:^|:\s*)([A-H])(\d+)/;
  const stdErrPattern = /\(Std Err\)/i;
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

  const timepoints = [];
  const rawData = {};
  wells.forEach(well => { rawData[well] = []; });

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter);
    if (values.length < 3) continue;
    const elapsed = parseFloat(values[timeColIdx]);
    if (isNaN(elapsed)) continue;
    timepoints.push(elapsed);
    wells.forEach(well => {
      const idx = wellIndices[well];
      const value = parseFloat(values[idx]);
      rawData[well].push(isNaN(value) ? null : value);
    });
  }

  return { wells, timepoints, rawData };
};
