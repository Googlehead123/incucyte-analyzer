import { describe, it, expect } from 'vitest';
import {
  FULL_SCALE_MAX,
  niceStep,
  computeYAxisScale,
  collectTimeCourseValues,
  collectBarValues,
} from '../chartAxis';

/** Every gap between consecutive ticks, rounded past float noise. */
const gaps = (ticks) =>
  ticks.slice(1).map((t, i) => Number((t - ticks[i]).toPrecision(12)));

describe('niceStep', () => {
  it('picks a round step near span / targetIntervals', () => {
    expect(niceStep(100, 5)).toBe(20);
    expect(niceStep(50, 5)).toBe(10);
    expect(niceStep(1000, 5)).toBe(200);
    expect(niceStep(1, 5)).toBe(0.2);
  });

  it('never returns zero or a negative step for degenerate spans', () => {
    for (const span of [0, -10, NaN, Infinity, undefined]) {
      expect(niceStep(span, 5)).toBeGreaterThan(0);
    }
  });

  it('falls back to a sane interval count when given a bad one', () => {
    for (const target of [0, -3, NaN, undefined]) {
      expect(niceStep(100, target)).toBeGreaterThan(0);
    }
  });
});

describe('computeYAxisScale', () => {
  describe('the reported bug: raw dataMax leaking onto the axis', () => {
    // A real run peaked at 63.53% closure. Recharts pinned its last tick to
    // that exact number, so the axis read [0, 20, 40, 63.53] and never showed
    // the 100% mark that makes a wound-healing plot readable.
    const values = [0, 12.4, 31.07, 48.9, 63.53];

    it('ends at 100%, not at the data maximum', () => {
      const { domain, ticks } = computeYAxisScale(values);
      expect(domain).toEqual([0, 100]);
      expect(ticks).toEqual([0, 20, 40, 60, 80, 100]);
    });

    it('puts no raw data value on the axis', () => {
      const { ticks } = computeYAxisScale(values);
      expect(ticks).not.toContain(63.53);
      for (const tick of ticks) expect(Number.isInteger(tick)).toBe(true);
    });
  });

  it('defaults to the full 0-100% scale so runs are comparable', () => {
    const weak = computeYAxisScale([0, 2, 5, 8]);
    const strong = computeYAxisScale([0, 40, 75, 96]);
    expect(weak.domain).toEqual([0, 100]);
    expect(strong.domain).toEqual([0, 100]);
  });

  it('extends past 100% in round steps when the wound over-closes', () => {
    const { domain, ticks } = computeYAxisScale([0, 60, 137.2]);
    expect(domain[0]).toBe(0);
    expect(domain[1]).toBeGreaterThanOrEqual(137.2);
    expect(ticks[ticks.length - 1]).toBe(domain[1]);
    for (const tick of ticks) expect(tick).toBe(Number(tick.toPrecision(12)));
  });

  it('drops below zero when the wound widens, instead of clipping the points', () => {
    // Regression guard for the earlier fix: a hard 0 floor hid negative RWD.
    const { domain, ticks } = computeYAxisScale([-12.4, 0, 30, 70]);
    expect(domain[0]).toBeLessThanOrEqual(-12.4);
    expect(ticks[0]).toBe(domain[0]);
  });

  it('keeps zero exactly on a gridline even with negative data', () => {
    for (const min of [-0.5, -3, -12.4, -27, -60]) {
      const { ticks } = computeYAxisScale([min, 50, 90]);
      expect(ticks).toContain(0);
    }
  });

  it('spaces ticks evenly', () => {
    const cases = [[0, 63.53], [-12, 70], [0, 137], [-40, 210], [0, 0.4]];
    for (const values of cases) {
      const { ticks } = computeYAxisScale(values);
      expect(new Set(gaps(ticks)).size).toBe(1);
    }
  });

  it('starts and ends its tick run on the domain bounds', () => {
    const cases = [[0, 63.53], [-12, 70], [0, 137], [-3, 99.9]];
    for (const values of cases) {
      const { domain, ticks } = computeYAxisScale(values);
      expect(ticks[0]).toBe(domain[0]);
      expect(ticks[ticks.length - 1]).toBe(domain[1]);
    }
  });

  describe('fit-to-data mode', () => {
    const opts = { fullScale: false };

    it('zooms in but still lands on round numbers', () => {
      const { domain, ticks } = computeYAxisScale([0, 3.1, 6.4, 8.2], opts);
      expect(domain[1]).toBeLessThan(FULL_SCALE_MAX);
      expect(domain[1]).toBeGreaterThanOrEqual(8.2);
      expect(ticks).not.toContain(8.2);
      expect(new Set(gaps(ticks)).size).toBe(1);
    });

    it('still anchors at zero', () => {
      expect(computeYAxisScale([20, 40, 60], opts).domain[0]).toBe(0);
    });

    it('never truncates data that runs past 100%', () => {
      const { domain } = computeYAxisScale([0, 50, 118], opts);
      expect(domain[1]).toBeGreaterThanOrEqual(118);
    });
  });

  describe('degenerate input', () => {
    it('returns the natural full scale when there is nothing to plot', () => {
      for (const values of [[], null, undefined]) {
        expect(computeYAxisScale(values).domain).toEqual([0, FULL_SCALE_MAX]);
      }
    });

    it('ignores nulls, NaN and Infinity', () => {
      const { domain } = computeYAxisScale([null, undefined, NaN, Infinity, -Infinity, '50']);
      expect(domain).toEqual([0, FULL_SCALE_MAX]);
    });

    it('still draws an axis when every value is zero', () => {
      const flat = computeYAxisScale([0, 0, 0], { fullScale: false });
      expect(flat.domain).toEqual([0, FULL_SCALE_MAX]);
      expect(flat.ticks.length).toBeGreaterThan(1);
    });

    it('mixes real values in among the junk', () => {
      const { domain } = computeYAxisScale([NaN, 42, null, 63.53], { fullScale: false });
      expect(domain[0]).toBe(0);
      expect(domain[1]).toBeGreaterThanOrEqual(63.53);
    });
  });
});

describe('collectTimeCourseValues', () => {
  const keyOf = (c) => `c${c.id}`;
  const conditions = [{ id: 1 }, { id: 2 }];
  const timeCourse = [
    { time: 0, c1_mean: 0, c2_mean: 0 },
    { time: 24, c1_mean: 41.2, c2_mean: 63.53 },
  ];

  it('gathers the plotted mean of every condition at every timepoint', () => {
    expect(collectTimeCourseValues(timeCourse, conditions, keyOf))
      .toEqual([0, 0, 41.2, 63.53]);
  });

  it('keys by id, so two conditions sharing a name stay separate', () => {
    // `c1_mean` and `c2_mean` both appear even though a caller might have named
    // both conditions "Drug A".
    const values = collectTimeCourseValues(timeCourse, conditions, keyOf);
    expect(values).toHaveLength(4);
  });

  it('survives empty and missing input', () => {
    expect(collectTimeCourseValues([], conditions, keyOf)).toEqual([]);
    expect(collectTimeCourseValues(null, conditions, keyOf)).toEqual([]);
    expect(collectTimeCourseValues(timeCourse, [], keyOf)).toEqual([]);
    expect(collectTimeCourseValues(timeCourse, null, keyOf)).toEqual([]);
  });

  it('yields an axis covering the data it collected', () => {
    const { domain } = computeYAxisScale(
      collectTimeCourseValues(timeCourse, conditions, keyOf)
    );
    expect(domain).toEqual([0, 100]);
  });
});

describe('collectBarValues', () => {
  it('includes both ends of each error bar so whiskers are not clipped', () => {
    expect(collectBarValues([{ value: 60, error: 8 }])).toEqual([68, 52]);
  });

  it('lets a downward whisker pull the axis below zero', () => {
    const { domain } = computeYAxisScale(
      collectBarValues([{ value: 4, error: 12 }])
    );
    expect(domain[0]).toBeLessThanOrEqual(-8);
  });

  it('lets an upward whisker push the axis past 100%', () => {
    const { domain } = computeYAxisScale(
      collectBarValues([{ value: 98, error: 15 }])
    );
    expect(domain[1]).toBeGreaterThanOrEqual(113);
  });

  it('treats a missing or non-finite error as zero', () => {
    expect(collectBarValues([{ value: 50 }])).toEqual([50, 50]);
    expect(collectBarValues([{ value: 50, error: NaN }])).toEqual([50, 50]);
    expect(collectBarValues([{ value: 50, error: null }])).toEqual([50, 50]);
  });

  it('skips bars with no usable value', () => {
    expect(collectBarValues([{ value: null, error: 3 }, { error: 3 }, {}])).toEqual([]);
  });

  it('survives empty and missing input', () => {
    expect(collectBarValues([])).toEqual([]);
    expect(collectBarValues(null)).toEqual([]);
  });
});
