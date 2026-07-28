# Incucyte Analyzer

## Overview
React-based wound healing analysis application for Incucyte live-cell imaging data.
4-step workflow: Upload → PlateMap → Review → Results.

Supports exports from both **Incucyte ZOOM** and **Incucyte SX5**. 96-well plates only
(rows A–H, columns 1–12).

## Tech Stack
- **Framework:** React 19 + Vite
- **Language:** JavaScript (JSX)
- **Charts:** Recharts
- **Statistics:** jstat (Welch's t-test) + in-house multiple-comparison correction
- **Export:** html2canvas (PNG), hand-rolled RFC-4180 CSV
- **Tests:** Vitest

There is no backend, no database and no auth. Everything runs client-side on a file the
user picks; nothing is uploaded. (An unreachable Supabase auth/admin subtree was removed
in the SX5 audit — do not reintroduce it without wiring it into `main.jsx`.)

## How to Run
```bash
npm run dev        # http://localhost:5173
npm run build      # Production build → dist/
npm run preview    # Preview production build
npm test           # Vitest (run once)
npm run test:watch # Vitest (watch)
npm run lint       # ESLint
```

## Key Files
- `src/App.jsx` — workflow state, well assignment, analysis orchestration
- `src/components/analyzer/` — the four step components
- `src/utils/statistics.js` — parser + descriptive stats, Welch's t-test, AUC, best-triplicate
- `src/utils/multipleComparisons.js` — Holm–Šidák / Bonferroni adjustment
- `src/utils/qc.js` — per-well QC flags and plate-level scan-failure detection
- `src/utils/exportCsv.js` — CSV assembly with RFC-4180 quoting
- `src/utils/plate.js` — 96-well geometry, edge-well helpers
- `src/utils/chartAxis.js` — y-axis domain + tick selection shared by both charts
- `src/utils/__tests__/` — Vitest specs + parser fixtures

## Conventions that are load-bearing

**Address conditions by `id`, never by name.** Condition names are user-editable free text
and two conditions may legitimately share one. `keyOf(condition)` in `App.jsx` produces the
`c<id>` key used throughout `processedData`. Keying by name silently merged conditions.

**Never auto-remove data.** QC flags are advisory. The Review step surfaces them and offers
a one-click exclude; the scientist decides. Anything dropped must be visible in the export.

**Correction defaults to off.** `correctionMethod` starts at `'none'` so analyses produced
before the option existed reproduce exactly. The method used is recorded in the CSV and in
the figure footer.

**Never hand Recharts a raw `dataMax` as a y-axis bound.** It pins the last tick to
whatever endpoint you give it, so the axis ends up labelled with the data maximum
(`[0, 20, 40, 63.53]`). Rounding the domain alone isn't enough either — its own tick
picker returns uneven runs like `[-10, 20, 50, 100]`. `computeYAxisScale` in
`chartAxis.js` chooses the domain and the ticks together; pass both to the axis.

**The y-axis defaults to the full 0–100% scale for percentage metrics.** 100% is a closed
wound, so a fixed scale is what makes two experiments comparable at a glance. A non-percentage
metric has no natural ceiling and starts fitted to the data instead (`isPercentMetric`).
"Fit to data" is opt-in per session and never changes any computed number. Both charts read
the same setting.

**Absent is `null`, never `0`.** `calculateStats` returns null mean/sd/sem for an empty set,
and a null sd/sem for n=1 where the sample SD is undefined. A lost frame used to plot as a
crash to 0% and a condition with no wells drew a flat 0% line; both looked like measurements.
Anything rendering these must handle null — `fmt()` in `ResultsStep` prints an em dash, and
`num()` in `exportCsv` writes an empty field.

**Untestable comparisons stay out of the correction family.** `tTest` sets `testable: false`
(not `p: 1`) when either group has <2 replicates, or when *both* groups have zero variance.
`runAnalysis` filters those out before adjusting, so an unassigned condition cannot inflate k
and weaken every real comparison. They report as `n/a`, and `untestedCount` surfaces them in
the figure footer. One constant group is deliberately still testable — Welch's t is well
defined there (df collapses to the other group's n−1) and discarding it would throw away a
real result.

**Absent AUC is `null`.** `calculateAUC` returns null below two measured points. When deriving
anything from it, guard *both* operands: `null / controlAUC * 100` coerces to 0 and reports a
confident "0.0% of control" for a condition that has no data at all.

**QC thresholds are calibrated in RWD percentage points.** `evaluateWell` and
`detectScanFailures` take `percentMetric`; when false they run only the scale-free checks
(missing data, empty well). Without that, a wound-width export in µm has every healthy well
flagged "outside the plausible range" and reported as a percentage.

**Only free text goes through `sanitizeCsvText`.** It apostrophe-prefixes `= + - @` so a
condition named `=Ctrl` renders as text rather than `#NAME?` in Excel. Never run it over
numbers — it would turn every negative value into `'-5.0000`.

**Parser header detection is fragile by nature.** Everything before the header is free text an
operator typed, and it has hijacked parsing twice: a job name `PLATE1_2` matched via the "E1"
inside it, and a `Notes:` value with three commas made a tab-separated export parse as CSV.
Delimiter and header row are therefore resolved *together* — each delimiter is scored by the
best header it can find (`findHeaderRow`), never by counting separators in arbitrary lines.
Add a fixture to `src/utils/__tests__/fixtures/` for any new export shape.

## Data format notes
Incucyte exports are tab-separated with a metadata preamble (`Label:`, `Metric:`,
`Analysis Job:` …), a blank line, then `Date Time / Elapsed / <well columns>`. Well headers
appear as `: B2` on SX5 and ZOOM, or `A1 : Relative Wound Density (%)` in CSV exports.
`(Std Err)` columns are skipped. Files use CRLF line endings.

The `Metric:` header is read on upload and becomes the y-axis label (`(Percent)` is tidied to
`(%)`), so a Wound Confluence export is labelled as Wound Confluence rather than as RWD. Exports
with no `Metric:` line fall back to "Relative Wound Density (%)".

## Deployment

**Merging to `main` is the deploy.** `.github/workflows/deploy.yml` builds and publishes to
GitHub Pages through `actions/deploy-pages`, and the site is live at
https://googlehead123.github.io/incucyte-analyzer/ within about a minute. Nothing else is
needed, and there is no other hosting — Pages is the only deployment target this repo has.

**There is deliberately no `deploy` script — do not add one back.** Pages is still the host;
what changed is how files get there. It used to serve the `gh-pages` branch, which is what the
old `gh-pages -d dist` script pushed to. It now serves the artifact the workflow uploads
(`build_type: workflow`) and no longer reads that branch, so the script exited 0, updated
`gh-pages`, and changed nothing live — a deploy that reports success and ships nothing. The
script and the `gh-pages` dependency were removed rather than documented around. Deploy by
merging.

`vite.config.js` sets `base: '/incucyte-analyzer/'` to match the Pages sub-path. Serving from
any other origin means changing that first, or every asset 404s.

**Confirm a deploy actually shipped**, rather than trusting a green workflow — Pages can serve a
cached bundle. The build is content-hashed, so compare what is live against a local build:

```bash
npm run build
curl -s https://googlehead123.github.io/incucyte-analyzer/ | grep -o 'assets/index-[^"]*\.js'
# same filename as dist/assets/index-*.js  ->  the new bundle is live
```
