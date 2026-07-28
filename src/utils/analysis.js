// The analysis pipeline, kept as a pure function so it can be tested without
// mounting the app: given the raw plate data and the user's settings, produce
// the complete results object the Results step renders.

import { calculateStats, tTest, calculateAUC, removeMinMax, selectBestTriplicate } from './statistics';
import { adjustPValues, CORRECTION_METHODS } from './multipleComparisons';

// Results are addressed by condition id, never by name: names are user-editable
// free text and two conditions may legitimately share one.
export const keyOf = (condition) => `c${condition.id}`;

export const OUTLIER_LABELS = {
  none: 'None',
  minmax: 'Min/Max removed per timepoint',
  bestTriplicate: 'Best Triplicate'
};

/**
 * @param {object} input
 * @param {Object<string, Array<number|null>>} input.rawData    per-well series
 * @param {Array<object>} input.conditions                      {id, name, color, wells}
 * @param {Array<number>} input.timepoints                      elapsed hours
 * @param {Set<string>} input.excludedWells
 * @param {'none'|'minmax'|'bestTriplicate'} input.outlierMethod
 * @param {'none'|'holmSidak'|'bonferroni'} input.correctionMethod
 * @param {number} input.selectedTimepoint                      endpoint, in hours
 * @param {number} input.controlConditionIdx
 * @returns {object|null} results, or null when there is nothing to analyse
 */
export const runAnalysis = ({
  rawData,
  conditions,
  timepoints,
  excludedWells,
  outlierMethod,
  correctionMethod,
  selectedTimepoint,
  controlConditionIdx,
}) => {
  if (!rawData || !conditions || conditions.length === 0) return null;

  const controlCondition = conditions[controlConditionIdx] || conditions[0];

  const results = {
    timeCourse: [],
    conditions: [...conditions],
    statistics: {},
    pValues: {},
    auc: {},
    controlKey: keyOf(controlCondition),
    controlName: controlCondition?.name,
    correctionMethod: CORRECTION_METHODS[correctionMethod] || CORRECTION_METHODS.none,
    comparisonCount: 0,
  };

  const selectedIdx = timepoints.findIndex(t => t === selectedTimepoint);

  // Well sets are resolved once, keyed by condition id. Keying by name here used
  // to make two identically-named conditions overwrite one another.
  const conditionWellsMap = {};
  conditions.forEach(condition => {
    const activeWells = condition.wells.filter(well => !excludedWells.has(well));
    conditionWellsMap[keyOf(condition)] =
      outlierMethod === 'bestTriplicate' && activeWells.length > 3 && selectedIdx >= 0
        ? selectBestTriplicate(activeWells, rawData, selectedIdx)
        : activeWells;
  });

  const valuesAt = (condition, timeIdx) => {
    let values = (conditionWellsMap[keyOf(condition)] || [])
      .map(well => rawData[well]?.[timeIdx])
      .filter(v => v !== null && v !== undefined && !isNaN(v));
    if (outlierMethod === 'minmax' && values.length > 2) values = removeMinMax(values);
    return values;
  };

  timepoints.forEach((time, timeIdx) => {
    const timeData = { time };
    conditions.forEach(condition => {
      const k = keyOf(condition);
      const stats = calculateStats(valuesAt(condition, timeIdx));
      // null, not 0, when nothing was measured — the line breaks into a gap
      // instead of dropping to the baseline and reading as a real collapse.
      timeData[`${k}_mean`] = stats.mean;
      timeData[`${k}_sd`] = stats.sd;
      timeData[`${k}_sem`] = stats.sem;
      timeData[`${k}_n`] = stats.n;
      // Marks a genuinely measured timepoint, so AUC can skip gaps instead of
      // integrating the 0 that calculateStats returns for an empty set.
      timeData[`${k}_hasData`] = stats.n > 0;
    });
    results.timeCourse.push(timeData);
  });

  if (selectedIdx >= 0) {
    const controlValues = valuesAt(controlCondition, selectedIdx);

    // Raw Welch tests first, then a single family-wise adjustment across all
    // treatment-vs-control comparisons. The control's self-comparison is excluded
    // — it is not a hypothesis test and would inflate the family size.
    const rawComparisons = [];
    conditions.forEach(condition => {
      const k = keyOf(condition);
      results.statistics[k] = calculateStats(valuesAt(condition, selectedIdx));
      if (k !== results.controlKey) {
        rawComparisons.push({ key: k, ...tTest(controlValues, results.statistics[k].values) });
      }
    });

    // Only comparisons that were actually run belong in the family. A condition
    // with no wells, or one replicate, cannot be tested — counting it would
    // inflate k and weaken every genuine comparison beside it.
    const testable = rawComparisons.filter(c => c.testable);
    const adjusted = adjustPValues(
      testable.map(c => ({ key: c.key, p: c.p })),
      correctionMethod
    );
    results.comparisonCount = testable.length;
    results.untestedCount = rawComparisons.length - testable.length;

    conditions.forEach(condition => {
      const k = keyOf(condition);
      if (k === results.controlKey) {
        results.pValues[k] = { p: null, pRaw: null, stars: '-', significant: false, testable: true };
      } else {
        const raw = rawComparisons.find(c => c.key === k);
        if (raw && !raw.testable) {
          results.pValues[k] = {
            p: null, pRaw: null, stars: 'n/a', significant: false,
            testable: false, reason: raw.reason,
          };
        } else {
          // `testable` is spread on explicitly: adjustPValues returns only the
          // p-value fields, so without this a successful comparison came back with
          // testable === undefined while every other branch set it. Consumers
          // testing `if (pValues[k].testable)` would have read that as untestable.
          results.pValues[k] = adjusted[k]
            ? { ...adjusted[k], testable: true }
            : { p: raw?.p ?? null, pRaw: raw?.p ?? null, stars: 'ns', significant: false, testable: true };
        }
      }
    });

    results.representativeWells = {};
    conditions.forEach(condition => {
      const k = keyOf(condition);
      const activeWells = condition.wells.filter(well => !excludedWells.has(well));
      const condMean = results.statistics[k]?.mean;
      // `== null` catches the no-data case too, now that an unmeasured condition
      // reports a null mean rather than 0.
      if (condMean == null || activeWells.length === 0) return;

      if (outlierMethod === 'bestTriplicate' && conditionWellsMap[k]) {
        results.representativeWells[k] = conditionWellsMap[k].map(well => ({
          well, value: rawData[well]?.[selectedIdx]
        }));
      } else {
        const wellDiffs = activeWells
          .map(well => {
            const val = rawData[well]?.[selectedIdx];
            if (val === null || val === undefined || isNaN(val)) return null;
            return { well, value: val, diff: Math.abs(val - condMean) };
          })
          .filter(Boolean)
          .sort((a, b) => a.diff - b.diff)
          .slice(0, 3);
        if (wellDiffs.length > 0) {
          results.representativeWells[k] = wellDiffs.map(w => ({ well: w.well, value: w.value }));
        }
      }
    });
  }

  // AUC integrates only over timepoints that actually have measurements, so a
  // gap no longer contributes a fabricated zero and drags the area down.
  conditions.forEach(condition => {
    const k = keyOf(condition);
    const measured = results.timeCourse.filter(tc => tc[`${k}_hasData`]);
    results.auc[k] = calculateAUC(
      measured.map(tc => tc.time),
      measured.map(tc => tc[`${k}_mean`])
    );
  });

  const controlAUC = results.auc[results.controlKey];
  conditions.forEach(condition => {
    const k = keyOf(condition);
    const auc = results.auc[k];
    // Both ends have to be real numbers. Guarding only the denominator let a null
    // numerator coerce to 0 in the division, so a condition with no data at all
    // reported a confident "0.0%" of control instead of "n/a".
    results.auc[`${k}_relative`] =
      typeof auc === 'number' && typeof controlAUC === 'number' && controlAUC !== 0
        ? (auc / controlAUC * 100).toFixed(1)
        : null;
  });

  return results;
};
