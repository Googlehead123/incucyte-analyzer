# Incucyte Wound Healing Analyzer

Analysis and publication-ready figures for wound healing (scratch) assays from Incucyte
live-cell imaging. Upload an export, map wells to conditions, review quality flags, get
statistics and charts.

Live: **https://googlehead123.github.io/incucyte-analyzer/**

Supports exports from **Incucyte ZOOM** and **Incucyte SX5**. 96-well plates (rows A–H,
columns 1–12).

## Everything runs in your browser

There is **no backend, no database and no accounts**. The file you pick is parsed in the
page and never leaves your machine — nothing is uploaded anywhere. That is a deliberate
property of this tool, not a missing feature: unpublished plate data stays on the instrument
PC, and there is no server to secure or credentials to manage.

The corollary is that nothing persists. Closing the tab discards the session, so export
anything you want to keep.

## Features

- **Parses real Incucyte exports** — tab-separated ZOOM/SX5 and CSV, handling the metadata
  preamble, `(Std Err)` columns and CRLF endings
- **Plate map** — click or drag to assign wells to conditions; row/column quick-assign
- **Automated QC** — flags wells whose wound mask likely failed (implausible early closure,
  single-frame dropouts, sustained collapse, flatlines) and detects plate-wide failed scans.
  Advisory only: nothing is removed unless you say so
- **Statistics** — Welch's t-test against a chosen control, with optional Holm–Šidák or
  Bonferroni correction for multiple comparisons; AUC; SD/SEM error bars
- **Charts** — time course and endpoint comparison, significance stars, three export themes
- **Export** — PNG at 3× scale, and a CSV carrying the statistics, the QC findings, every
  excluded well, and the exact settings used, so a figure can be traced back to its analysis

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Getting started

```bash
git clone <repository-url>
cd incucyte-analyzer
npm install
npm run dev          # http://localhost:5173/incucyte-analyzer/
```

No configuration and no environment variables — the app reads none.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest, watch mode |
| `npm run lint` | ESLint |

## Tech stack

React 19 + Vite · Recharts for charts · jstat for the t-distribution · html2canvas for PNG
export · Vitest for tests. JavaScript throughout, no TypeScript.

## Project structure

```
src/
├── App.jsx                       workflow state, well assignment, analysis orchestration
├── main.jsx                      entry point
├── components/analyzer/          the four workflow steps
│   ├── UploadStep.jsx
│   ├── PlateMapStep.jsx
│   ├── ReviewStep.jsx            per-well QC review and analysis settings
│   └── ResultsStep.jsx           charts, statistics tables, export
└── utils/
    ├── statistics.js             export parser, descriptive stats, Welch's t-test, AUC
    ├── analysis.js               the analysis pipeline, as a pure testable function
    ├── multipleComparisons.js    Holm–Šidák / Bonferroni adjustment
    ├── qc.js                     per-well QC flags, plate-level scan-failure detection
    ├── chartAxis.js              y-axis domain and tick selection
    ├── exportCsv.js              CSV assembly with RFC-4180 quoting
    ├── plate.js                  96-well geometry, edge-well helpers
    └── __tests__/                Vitest specs and parser fixtures
```

The workflow is Upload → Map Wells → Review → Results.

## Data format

Incucyte exports are tab-separated with a metadata preamble (`Label:`, `Metric:`,
`Analysis Job:` …), a blank line, then `Date Time / Elapsed / <well columns>`. Well headers
appear as `: B2` on SX5 and ZOOM, or `A1 : Relative Wound Density (%)` in CSV exports.
`(Std Err)` columns are skipped and files use CRLF endings.

The `Metric:` header is read and becomes the y-axis label, so a Wound Confluence export is
labelled as such rather than as Relative Wound Density.

## Deployment

**Merging to `main` deploys.** `.github/workflows/deploy.yml` builds and publishes to GitHub
Pages, which is the only deployment target. There is no other hosting and no deploy script to
run — see the Deployment section of `CLAUDE.md` for the details, and for how to confirm a
deploy actually shipped.

## Contributing

`CLAUDE.md` documents the conventions that are load-bearing — invariants that have each been
broken at least once and produced a wrong number or a misleading chart. Read it before
changing the parser, the statistics, or anything that renders a value.
