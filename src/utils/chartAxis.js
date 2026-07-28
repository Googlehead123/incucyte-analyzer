/**
 * Y-axis scaling for the wound-density charts.
 *
 * Recharts pins the final tick to whatever numeric domain endpoint you hand it
 * (`getTickValuesFixedDomain`), so passing a raw `dataMax` produced an axis
 * labelled with the data maximum itself — `[0, 20, 40, 63.53]`. It also meant
 * the axis stopped wherever the data happened to stop, so 60% closure and 95%
 * closure drew identical-looking plots and could not be compared by eye.
 *
 * Letting Recharts pick the ticks from a rounded domain is not enough either:
 * `getTickValuesFixedDomain([-10, 100], 5)` returns `[-10, 20, 50, 100]`, whose
 * last interval is 5/3 as wide as the others. So the domain and the ticks are
 * chosen together here and both are handed to the axis.
 */

/**
 * Relative Wound Density is expressed as a percentage of the original wound:
 * 0% is the wound at its starting width, 100% is a closed wound.
 */
export const FULL_SCALE_MAX = 100;

/** Tick steps that read cleanly on a printed axis, scaled by powers of ten. */
const NICE_MANTISSAS = [1, 2, 2.5, 5, 10];

/** Strip binary-float drift so ticks render as `60`, not `60.000000000000014`. */
const clean = (value) => Number(value.toPrecision(12));

/**
 * Smallest "nice" step that divides `span` into roughly `targetIntervals` parts.
 *
 * @param {number} span Distance the axis has to cover. Non-positive spans fall
 *   back to 1 so callers never divide by zero.
 * @param {number} [targetIntervals] Preferred tick count; treated as a hint,
 *   since a round step matters more than an exact number of gridlines.
 * @returns {number} Step size, always > 0.
 */
export function niceStep(span, targetIntervals = 5) {
  if (!Number.isFinite(span) || span <= 0) return 1;
  if (!Number.isFinite(targetIntervals) || targetIntervals < 1) targetIntervals = 5;

  const rough = span / targetIntervals;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  // 1e-9 keeps a normalized value of exactly 2 from being pushed up to 2.5 by
  // the float representation of the division above.
  const mantissa = NICE_MANTISSAS.find((m) => normalized <= m + 1e-9) ?? 10;

  return clean(mantissa * magnitude);
}

/**
 * Pick a rounded domain and an evenly spaced tick set for a wound-density axis.
 *
 * Zero is always inside the domain: it is the wound at its original width, so
 * an axis that floats off the baseline would misrepresent how much closure
 * actually happened. The axis only drops below zero when the wound genuinely
 * widened — Relative Wound Density does go negative early in some runs, and a
 * hard 0 floor used to hide those points.
 *
 * Because both bounds are rounded outward to a multiple of the same step, zero
 * always lands exactly on a gridline.
 *
 * @param {Array<number|null|undefined>} values Every value the axis must show,
 *   including error-bar extents. Non-finite entries are ignored.
 * @param {object} [options]
 * @param {boolean} [options.fullScale] When true (the default) the axis always
 *   spans at least 0–100%, so plots from different experiments are comparable.
 *   When false it zooms to the data, still on round numbers.
 * @param {number} [options.targetIntervals] Preferred number of gridlines.
 * @returns {{domain: [number, number], ticks: number[]}}
 */
export function computeYAxisScale(values, options = {}) {
  const { fullScale = true, targetIntervals = 5 } = options;

  // Reduce rather than spread into Math.min/max: the caller passes one entry
  // per condition per timepoint, which can exceed the argument limit on a long
  // run with many conditions.
  let dataMin = Infinity;
  let dataMax = -Infinity;
  for (const value of values || []) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (value < dataMin) dataMin = value;
    if (value > dataMax) dataMax = value;
  }
  const hasData = dataMin <= dataMax;

  let lo = hasData ? Math.min(0, dataMin) : 0;
  let hi = fullScale
    ? Math.max(FULL_SCALE_MAX, hasData ? dataMax : 0)
    : Math.max(0, hasData ? dataMax : 0);

  // No data, or every value sitting exactly on the baseline, still needs an
  // axis to draw. Fall back to the metric's natural range.
  if (!(hi - lo > 0)) hi = FULL_SCALE_MAX;

  const step = niceStep(hi - lo, targetIntervals);
  lo = clean(Math.floor(lo / step) * step);
  hi = clean(Math.ceil(hi / step) * step);

  // Index-multiply instead of accumulating `t += step`, which drifts.
  const count = Math.round((hi - lo) / step);
  const ticks = Array.from({ length: count + 1 }, (_, i) => clean(lo + i * step));

  return { domain: [lo, hi], ticks };
}

/**
 * Collect the plotted mean of every condition at every timepoint.
 *
 * @param {Array<object>} timeCourse Rows from `processedData.timeCourse`.
 * @param {Array<object>} conditions Conditions currently being drawn.
 * @param {(condition: object) => string} keyOf Condition-to-key mapper.
 * @returns {number[]}
 */
export function collectTimeCourseValues(timeCourse, conditions, keyOf) {
  const values = [];
  for (const row of timeCourse || []) {
    for (const condition of conditions || []) {
      values.push(row?.[`${keyOf(condition)}_mean`]);
    }
  }
  return values;
}

/**
 * Collect both ends of every error bar, so a whisker is never clipped by the
 * axis even when the bar itself is well inside it.
 *
 * @param {Array<{value?: number, error?: number}>} barChartData
 * @returns {number[]}
 */
export function collectBarValues(barChartData) {
  const values = [];
  for (const bar of barChartData || []) {
    const value = bar?.value;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const error = typeof bar?.error === 'number' && Number.isFinite(bar.error) ? bar.error : 0;
    values.push(value + error, value - error);
  }
  return values;
}
