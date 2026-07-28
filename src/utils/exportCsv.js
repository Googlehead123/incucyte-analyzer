// CSV construction for analysis exports.
//
// Condition names are free text typed by the user — "TGF-b, 10 ng/mL" is a
// perfectly reasonable label and it used to shift every column to its right by
// one, silently corrupting the exported statistics. Everything here goes through
// RFC-4180 quoting.

// Quote a field if it contains a comma, quote, CR or LF; double any inner quotes.
export const csvField = (value) => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const csvRow = (fields) => fields.map(csvField).join(',');

const num = (v, digits = 4) =>
  typeof v === 'number' && !Number.isNaN(v) ? v.toFixed(digits) : '';

/**
 * Build the full analysis CSV.
 *
 * Conditions are addressed by `id` internally (see buildResultKey in App) so two
 * conditions sharing a name no longer collide; the name is used for display only.
 */
export const buildAnalysisCsv = ({
  processedData,
  conditions,
  timepoints,
  rawData,
  excludedWells,
  selectedTimepoint,
  outlierMethod,
  correctionMethod,
  qcReport,
  keyOf,
}) => {
  const lines = [];

  // --- Section 1: time course --------------------------------------------
  lines.push(
    csvRow([
      'Time (h)',
      ...conditions.flatMap(c => [
        `${c.name} Mean`,
        `${c.name} SD`,
        `${c.name} SEM`,
        `${c.name} N`,
      ]),
    ])
  );
  processedData.timeCourse.forEach(row => {
    lines.push(
      csvRow([
        row.time,
        ...conditions.flatMap(c => {
          const k = keyOf(c);
          return [
            num(row[`${k}_mean`]),
            num(row[`${k}_sd`]),
            num(row[`${k}_sem`]),
            row[`${k}_n`] ?? '',
          ];
        }),
      ])
    );
  });

  // --- Section 2: endpoint statistics ------------------------------------
  lines.push('');
  lines.push('');
  lines.push(csvRow([`Endpoint Statistics (t=${selectedTimepoint}h)`]));
  lines.push(
    csvRow([
      'Condition',
      'Mean',
      'SD',
      'SEM',
      'N',
      'p-value (raw)',
      'p-value (adjusted)',
      'Significance',
      'AUC',
      'Relative AUC (%)',
      'Rep. Well 1',
      'Rep. Value 1',
      'Rep. Well 2',
      'Rep. Value 2',
      'Rep. Well 3',
      'Rep. Value 3',
    ])
  );
  conditions.forEach(c => {
    const k = keyOf(c);
    const s = processedData.statistics[k] || {};
    const p = processedData.pValues[k] || {};
    const reps = processedData.representativeWells?.[k] || [];
    const fmtP = v =>
      typeof v === 'number' && !Number.isNaN(v)
        ? v < 0.0001
          ? v.toExponential(4)
          : v.toFixed(4)
        : '';
    lines.push(
      csvRow([
        c.name,
        num(s.mean),
        num(s.sd),
        num(s.sem),
        s.n ?? '',
        fmtP(p.pRaw),
        fmtP(p.p),
        p.stars || '',
        num(processedData.auc[k], 2),
        processedData.auc[`${k}_relative`] ?? '',
        ...[0, 1, 2].flatMap(i => [reps[i]?.well || '', num(reps[i]?.value)]),
      ])
    );
  });

  // --- Section 3: method provenance --------------------------------------
  // Written into the file so a figure can always be traced back to the exact
  // settings that produced it.
  lines.push('');
  lines.push('');
  lines.push(csvRow(['Analysis Method']));
  lines.push(csvRow(['Endpoint timepoint (h)', selectedTimepoint]));
  lines.push(csvRow(['Statistical test', "Welch's t-test (two-tailed), each condition vs control"]));
  lines.push(csvRow(['Multiple-comparison correction', correctionMethod]));
  lines.push(csvRow(['Well selection / outlier handling', outlierMethod]));
  if (outlierMethod === 'Best Triplicate') {
    lines.push(
      csvRow([
        'Caution',
        'Best Triplicate selects the 3 wells with the smallest variance. This is a ' +
          'selection rule, not outlier rejection: it biases SD/SEM downward and makes ' +
          'p-values anti-conservative. Report it explicitly in any publication.',
      ])
    );
  }

  // --- Section 4: QC flags -------------------------------------------------
  const qcEntries = Object.entries(qcReport || {});
  if (qcEntries.length) {
    lines.push('');
    lines.push('');
    lines.push(csvRow(['Quality-Control Flags (advisory — no data was auto-removed)']));
    lines.push(csvRow(['Well', 'Severity', 'Finding']));
    qcEntries.forEach(([well, r]) => {
      r.flags.forEach(f => lines.push(csvRow([well, r.severity, f.message])));
    });
  }

  // --- Section 5: excluded wells ------------------------------------------
  // Anything dropped has to stay visible, otherwise the export silently claims a
  // cleaner experiment than was run. Excluded wells used to vanish from the file
  // entirely unless QC happened to have flagged them.
  const excluded = conditions.flatMap(c =>
    c.wells.filter(w => excludedWells?.has(w)).map(w => ({ well: w, condition: c.name }))
  );
  lines.push('');
  lines.push('');
  lines.push(csvRow(['Excluded Wells (removed from every statistic above)']));
  if (excluded.length === 0) {
    lines.push(csvRow(['None — every assigned well was included.']));
  } else {
    lines.push(csvRow(['Well', 'Condition', 'QC finding at time of exclusion']));
    excluded.forEach(({ well, condition }) => {
      const flags = qcReport?.[well]?.flags;
      lines.push(
        csvRow([
          well,
          condition,
          flags?.length ? flags.map(f => f.message).join(' ') : 'No QC flag — excluded manually',
        ])
      );
    });
  }

  // --- Section 6: raw per-well time course --------------------------------
  // Every assigned well appears, excluded ones marked in the column header, so
  // the numbers behind a dropped well can still be audited.
  lines.push('');
  lines.push('');
  lines.push(csvRow(['Raw Well Data (Time Course)']));
  conditions.forEach(c => {
    if (c.wells.length === 0) return;
    lines.push('');
    lines.push(csvRow([c.name]));
    lines.push(
      csvRow(['Time (h)', ...c.wells.map(w => (excludedWells?.has(w) ? `${w} (excluded)` : w))])
    );
    timepoints.forEach((time, timeIdx) => {
      lines.push(csvRow([time, ...c.wells.map(w => num(rawData[w]?.[timeIdx]))]));
    });
  });

  return lines.join('\n') + '\n';
};
