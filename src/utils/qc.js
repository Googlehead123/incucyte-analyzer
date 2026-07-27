// Automated quality-control flags for per-well wound-healing time courses.
//
// Motivation: Incucyte wound-mask segmentation fails silently. When the scratch
// is not detected the instrument still reports a Relative Wound Density for the
// well — it is simply measuring the wrong region. On a real SX5 export from this
// lab, 18 of 72 wells already read >40% RWD two hours after wounding, which is
// biologically impossible for a confluent monolayer and is a mask failure, not
// fast healing. Those wells silently pull group means and inflate variance.
//
// These checks are ADVISORY ONLY. Nothing is auto-excluded — a flagged well is
// surfaced in the Review step with a one-click exclude, and the scientist keeps
// the final call. Auto-dropping data would be a worse failure than not flagging.

export const QC_DEFAULTS = {
  // A monolayer cannot genuinely close this much this early. Anything above
  // `earlyMaxRwd` within the first `earlyFraction` of the run is a mask failure.
  earlyMaxRwd: 40,
  earlyFraction: 0.25,
  // An isolated timepoint that departs from the straight line between its two
  // neighbours by more than this is a single-frame segmentation failure (a
  // dropped or misfocused image), not biology. Calibrated against real exports:
  // a clean ZOOM plate produces zero of these, while a compromised SX5 plate
  // from this lab produced 149 across 72 wells.
  spikeDeviation: 15,
  // A *sustained* fall from the running peak — cells detaching, or the mask
  // losing the wound for good. Requires both an absolute and a relative drop so
  // that jitter on a high plateau is not mistaken for collapse.
  sustainedDropAbs: 25,
  sustainedDropRel: 0.4,
  sustainedDropPoints: 2,
  // Final value at/below this means the scratch never closed: dead well,
  // failed wound, or a mask locked onto nothing.
  flatlineMaxFinal: 2,
  // Physically implausible values. RWD may legitimately go slightly negative
  // (wound widening early on), so the lower bound is generous.
  minPlausible: -25,
  maxPlausible: 125,
};

export const QC_SEVERITY = { high: 'high', low: 'low' };

/**
 * Times at which a reading falls outside the interval spanned by its two
 * immediate neighbours, by more than `deviation`.
 *
 * Testing against the neighbour *interval* rather than their midpoint is what
 * separates a bad frame from a steep curve: on any monotonic trajectory —
 * however fast it accelerates — each point lies between its neighbours, so it
 * can never be flagged. Only a reading that reverses direction and comes back
 * (a dropout or a spike) escapes the interval.
 *
 * Endpoints have no neighbour on one side and are skipped.
 *
 * Known limitation: a severe dropout sits inside its neighbours' windows too, so
 * if the curve is also stepping by more than `deviation` per interval the point
 * beside a dropout can be flagged alongside it. On real scan intervals the step
 * is far smaller than the threshold, so this is rare and errs toward flagging.
 */
export const findSpikes = (series, timepoints, deviation) => {
  const hits = [];
  for (let i = 1; i < series.length - 1; i++) {
    const prev = series[i - 1];
    const cur = series[i];
    const next = series[i + 1];
    if (prev === null || cur === null || next === null) continue;
    const lo = Math.min(prev, next);
    const hi = Math.max(prev, next);
    const excursion = cur < lo ? lo - cur : cur > hi ? cur - hi : 0;
    if (excursion > deviation) hits.push(timepoints?.[i] ?? i);
  }
  return hits;
};

/**
 * A fall from the running peak that is large in both absolute and relative terms
 * and persists for at least `sustainedDropPoints` consecutive readings.
 */
export const findSustainedDrop = (series, cfg) => {
  let peak = -Infinity;
  let run = 0;
  let best = null;
  for (const v of series) {
    if (v === null) continue;
    if (v > peak) { peak = v; run = 0; continue; }
    const drop = peak - v;
    const rel = peak > 0 ? drop / peak : 0;
    if (drop > cfg.sustainedDropAbs && rel > cfg.sustainedDropRel) {
      run += 1;
      if (run >= cfg.sustainedDropPoints && (!best || drop > best.drop)) {
        best = { drop, rel, peak };
      }
    } else {
      run = 0;
    }
  }
  return best;
};

/**
 * Plate-level check: when the same timepoint is anomalous across many wells the
 * problem is the scan, not the wells. Excluding that timepoint is the right fix;
 * excluding the wells would throw away most of the plate.
 *
 * @returns {Array<{time: number, wells: number, fraction: number}>} sorted worst-first
 */
export const detectScanFailures = (wells, rawData, timepoints, opts = {}) => {
  const cfg = { ...QC_DEFAULTS, ...opts };
  const minFraction = opts.minFraction ?? 0.25;
  const counts = new Map();
  const list = wells || [];
  list.forEach(well => {
    const series = (rawData?.[well] || []).map(v =>
      v === null || v === undefined || Number.isNaN(v) ? null : v
    );
    findSpikes(series, timepoints, cfg.spikeDeviation).forEach(t =>
      counts.set(t, (counts.get(t) || 0) + 1)
    );
  });
  if (list.length === 0) return [];
  return [...counts.entries()]
    .map(([time, n]) => ({ time, wells: n, fraction: n / list.length }))
    .filter(r => r.fraction >= minFraction)
    .sort((a, b) => b.wells - a.wells);
};

/**
 * Evaluate one well's time course.
 *
 * @param {Array<number|null>} values  per-timepoint values, aligned to `timepoints`
 * @param {Array<number>} timepoints   elapsed hours
 * @param {object} [opts]              threshold overrides (see QC_DEFAULTS)
 * @returns {{flags: Array<{code: string, severity: string, message: string}>, severity: string|null}}
 */
export const evaluateWell = (values, timepoints, opts = {}) => {
  const cfg = { ...QC_DEFAULTS, ...opts };
  const flags = [];

  const series = (values || []).map(v =>
    v === null || v === undefined || Number.isNaN(v) ? null : v
  );
  const present = series.filter(v => v !== null);

  if (present.length === 0) {
    flags.push({
      code: 'noData',
      severity: QC_SEVERITY.high,
      message: 'No numeric data in this well.',
    });
    return { flags, severity: QC_SEVERITY.high };
  }

  // --- Missing timepoints -------------------------------------------------
  if (present.length < series.length) {
    flags.push({
      code: 'missing',
      severity: QC_SEVERITY.low,
      message: `${series.length - present.length} of ${series.length} timepoints are missing.`,
    });
  }

  // --- Implausible early jump (the dominant SX5 mask failure) -------------
  const maxTime = timepoints?.length ? Math.max(...timepoints) : 0;
  const earlyCutoff = maxTime * cfg.earlyFraction;
  // Report the EARLIEST offending timepoint, not the largest value: knowing the
  // well was already wrong at 2h says "the mask never found the wound", which is
  // the actionable diagnosis.
  let firstEarly = null;
  series.forEach((v, i) => {
    const t = timepoints?.[i];
    // t > 0 so the mandatory 0h baseline is never itself flagged.
    if (v === null || t === undefined || t <= 0 || t > earlyCutoff) return;
    if (v > cfg.earlyMaxRwd && firstEarly === null) {
      firstEarly = { v, t };
    }
  });
  if (firstEarly) {
    flags.push({
      code: 'earlyJump',
      severity: QC_SEVERITY.high,
      message: `Reads ${firstEarly.v.toFixed(0)}% at ${firstEarly.t}h — too high this early; the wound mask likely failed.`,
    });
  }

  // --- Out-of-range values ------------------------------------------------
  const lo = Math.min(...present);
  const hi = Math.max(...present);
  if (lo < cfg.minPlausible || hi > cfg.maxPlausible) {
    flags.push({
      code: 'outOfRange',
      severity: QC_SEVERITY.high,
      message: `Values span ${lo.toFixed(1)}% to ${hi.toFixed(1)}%, outside the plausible range.`,
    });
  }

  // --- Isolated single-timepoint spikes / dropouts ------------------------
  // A point is anomalous when it departs sharply from the line between its two
  // neighbours *and* those neighbours agree with each other — that pattern means
  // one frame failed, not that the trajectory genuinely changed.
  const spikeTimes = findSpikes(series, timepoints, cfg.spikeDeviation);
  if (spikeTimes.length) {
    const shown = spikeTimes.slice(0, 4).map(t => `${t}h`).join(', ');
    flags.push({
      code: 'spike',
      severity: QC_SEVERITY.low,
      message:
        `${spikeTimes.length} isolated timepoint${spikeTimes.length > 1 ? 's' : ''} ` +
        `(${shown}${spikeTimes.length > 4 ? ', …' : ''}) jump away from the neighbouring ` +
        `readings — likely a dropped or misfocused frame.`,
    });
  }

  // --- Sustained collapse from the running peak ---------------------------
  const collapse = findSustainedDrop(series, cfg);
  if (collapse) {
    flags.push({
      code: 'sustainedDrop',
      severity: QC_SEVERITY.low,
      message: `Falls ${collapse.drop.toFixed(0)} points (${(collapse.rel * 100).toFixed(0)}%) below its peak of ${collapse.peak.toFixed(0)}% and stays down — possible cell detachment or a lost wound mask.`,
    });
  }

  // --- Flatline -----------------------------------------------------------
  const final = present[present.length - 1];
  if (final <= cfg.flatlineMaxFinal) {
    flags.push({
      code: 'flatline',
      severity: QC_SEVERITY.low,
      message: `Ends at ${final.toFixed(1)}% — the wound effectively never closed.`,
    });
  }

  const severity = flags.some(f => f.severity === QC_SEVERITY.high)
    ? QC_SEVERITY.high
    : flags.length
      ? QC_SEVERITY.low
      : null;

  return { flags, severity };
};

/**
 * Evaluate every well that is assigned to a condition.
 *
 * @returns {Object<string, {flags: Array, severity: string}>} keyed by well;
 *          wells with no findings are omitted so callers can use a simple lookup.
 */
export const evaluateWells = (wells, rawData, timepoints, opts = {}) => {
  const report = {};
  (wells || []).forEach(well => {
    const result = evaluateWell(rawData?.[well], timepoints, opts);
    if (result.severity) report[well] = result;
  });
  return report;
};

export const countBySeverity = (report) => {
  const values = Object.values(report || {});
  return {
    high: values.filter(r => r.severity === QC_SEVERITY.high).length,
    low: values.filter(r => r.severity === QC_SEVERITY.low).length,
    total: values.length,
  };
};
