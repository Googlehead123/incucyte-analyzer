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

**Parser header detection is fragile by nature.** Job names in the metadata block can contain
well-shaped substrings (a real export named `PLATE1_2` once hijacked detection via the "E1"
inside it). Header detection prefers an `Elapsed` column and otherwise requires ≥2 well
columns. Add a fixture to `src/utils/__tests__/fixtures/` for any new export shape.

## Data format notes
Incucyte exports are tab-separated with a metadata preamble (`Label:`, `Metric:`,
`Analysis Job:` …), a blank line, then `Date Time / Elapsed / <well columns>`. Well headers
appear as `: B2` on SX5 and ZOOM, or `A1 : Relative Wound Density (%)` in CSV exports.
`(Std Err)` columns are skipped. Files use CRLF line endings.

The Y-axis label is hardcoded to "Relative Wound Density (%)"; the `Metric:` header is not
read. Uploading a Wound Confluence export will plot correctly but be labelled as RWD.

## Deployment
- GitHub Pages: `npm run deploy` (gh-pages)
- Vercel: auto-deploy from `dist/`
