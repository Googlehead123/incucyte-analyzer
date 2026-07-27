// Multiple-comparison correction for many-treatments-vs-one-control designs.
//
// Every treatment is compared to the same control with its own Welch t-test.
// Running k such tests at alpha=0.05 inflates the family-wise error rate to
// roughly 1-(1-0.05)^k — with 11 conditions that is ~43%, i.e. a coin-flip
// chance of at least one spurious star on the figure.
//
// Holm-Sidak is the default correction here: it is uniformly more powerful than
// Bonferroni, makes no assumption that the comparisons are independent in a way
// that would break under correlated wells, and — unlike Dunnett — needs no
// pooled-variance assumption, so it composes correctly with the Welch tests the
// app already runs.
//
// Correction is OFF by default so previously exported analyses reproduce exactly.

export const CORRECTION_METHODS = {
  none: 'Uncorrected',
  holmSidak: 'Holm-Sidak',
  bonferroni: 'Bonferroni',
};

// Stars use the *adjusted* p-value so the figure and the number agree.
export const starsFor = (p) =>
  p == null || Number.isNaN(p) ? 'ns'
    : p < 0.001 ? '***'
    : p < 0.01 ? '**'
    : p < 0.05 ? '*'
    : 'ns';

/**
 * Adjust a set of raw p-values.
 *
 * @param {Array<{key: string, p: number}>} comparisons  raw p-values, one per
 *        treatment-vs-control test. The control's own self-comparison must NOT
 *        be included — it is not a hypothesis test and would inflate k.
 * @param {'none'|'holmSidak'|'bonferroni'} method
 * @returns {Object<string, {p: number, pRaw: number, stars: string, significant: boolean}>}
 *          keyed by the caller's `key`.
 */
export const adjustPValues = (comparisons, method = 'none') => {
  const out = {};
  const valid = (comparisons || []).filter(
    c => c && typeof c.p === 'number' && !Number.isNaN(c.p)
  );
  const k = valid.length;

  if (k === 0) return out;

  if (method === 'none') {
    valid.forEach(({ key, p }) => {
      out[key] = { p, pRaw: p, stars: starsFor(p), significant: p < 0.05 };
    });
    return out;
  }

  if (method === 'bonferroni') {
    valid.forEach(({ key, p }) => {
      const adj = Math.min(1, p * k);
      out[key] = { p: adj, pRaw: p, stars: starsFor(adj), significant: adj < 0.05 };
    });
    return out;
  }

  // Holm-Sidak: sort ascending, adjust the i-th smallest with the number of
  // hypotheses still under test (k-i), then enforce monotonicity so an adjusted
  // p-value can never fall below one ranked ahead of it.
  const sorted = [...valid].sort((a, b) => a.p - b.p);
  let running = 0;
  sorted.forEach(({ key, p }, i) => {
    const remaining = k - i;
    // remaining === 1 is the identity; going through Math.pow would perturb the
    // largest p-value by an ULP and make it look adjusted when it is not.
    const adj = remaining === 1 ? p : 1 - Math.pow(1 - p, remaining);
    running = Math.max(running, Math.min(1, adj));
    out[key] = { p: running, pRaw: p, stars: starsFor(running), significant: running < 0.05 };
  });

  return out;
};
