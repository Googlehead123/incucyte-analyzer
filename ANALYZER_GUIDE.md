# Incucyte Wound Healing Analyzer - Complete Guide for Researchers

## Overview: What This Tool Does

This is a **web-based wound healing assay analyzer** that automates the analysis of scratch assay data from the Sartorius Incucyte ZOOM system. Instead of manually processing data in Excel or GraphPad, researchers upload raw export files and get publication-ready figures with statistics in minutes.

---

## The 4-Step Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. UPLOAD  │ →  │  2. MAP     │ →  │  3. REVIEW  │ →  │  4. RESULTS │
│   Raw Data  │    │   Wells     │    │   Settings  │    │   & Export  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Component-by-Component Explanation

### 1. Data Parser

**What it does:** Reads the tab-separated text file exported from Incucyte ZOOM.

**How it works:**

Input file format:
```
Date Time    Elapsed    B2         B3         C2         C3
2024-01-16   0          0          0          0          0
2024-01-16   2          8.44       7.16       12.3       11.8
```

**The parser:**
1. Finds the header row (looks for "Elapsed" or well patterns like "B2")
2. Extracts well names using regex pattern `[A-H]\d+` (matches A1-H12)
3. Creates a data structure with wells, timepoints, and raw data values

**Analogy:** Like a translator converting a foreign document into a format your computer can work with.

---

### 2. Statistical Functions

#### Descriptive Statistics (Mean, SD, SEM)

| Statistic | Formula | Meaning |
|-----------|---------|---------|
| **Mean** | Σx / n | Average value |
| **SD** | √(Σ(x-μ)²/(n-1)) | Spread of data (sample standard deviation) |
| **SEM** | SD / √n | Precision of the mean estimate |

**When to use which:**
- **SD** → Shows variability in your raw data ("how spread out are my replicates?")
- **SEM** → Shows precision of your mean ("how confident am I in this average?")

**For publications:** Most journals prefer SEM for comparing group means.

---

#### Welch's t-test

**Purpose:** Determines if two groups are statistically different.

**Why Welch's (not Student's)?** Welch's t-test doesn't assume equal variances between groups - more robust for biological data where variance often differs between control and treatment.

**The calculation:**
1. Calculate means (m₁, m₂) and variances (v₁, v₂) for both groups
2. Compute t-statistic: `t = (m₁ - m₂) / √(v₁/n₁ + v₂/n₂)`
3. Calculate degrees of freedom using Welch-Satterthwaite formula
4. Convert t to p-value using t-distribution

**Output interpretation:**

| p-value | Stars | Meaning |
|---------|-------|---------|
| p < 0.05 | * | Significant |
| p < 0.01 | ** | Highly significant |
| p < 0.001 | *** | Very highly significant |
| p ≥ 0.05 | ns | Not significant |

**Analogy:** Like asking "if I repeated this experiment 100 times, how often would I see a difference this big just by chance?" If the answer is less than 5% (p<0.05), we call it significant.

---

#### Area Under Curve (AUC)

**Purpose:** Quantifies total wound healing over the entire experiment, not just the endpoint.

**Method:** Trapezoidal integration
```
AUC = Σ [(tᵢ - tᵢ₋₁) × (vᵢ + vᵢ₋₁)/2]
```

**Why AUC matters:**
- Two treatments might reach the same endpoint (e.g., 80% closure at 24h)
- But one might have gotten there faster or maintained healing better
- AUC captures the ENTIRE healing trajectory

**Analogy:** Like comparing two runners - one might finish at the same time but ran more total distance (took a longer route). AUC measures "total ground covered."

---

### 3. Outlier Removal

**What it does:** Removes the highest and lowest values from each group.

**Why:** In 96-well plates, edge wells often behave differently (edge effects), or occasional bubbles/debris cause artifacts. Removing extremes gives more robust statistics.

**When it's applied:** Only when you have >2 replicates (otherwise you'd have nothing left!)

**Analogy:** Like a gymnastics judge removing the highest and lowest scores to prevent one biased judge from skewing results.

---

### 4. Chart Components

#### Time Course Graph (Line Chart)
- **Shows:** Wound closure over time for each condition
- **X-axis:** Time in hours
- **Y-axis:** Relative Wound Density (%)
- **Lines:** Mean values for each condition
- **Purpose:** Visualize healing kinetics

#### Endpoint Bar Chart
- **Shows:** Final wound density at selected timepoint
- **Bars:** Mean ± error bars
- **Stars:** Significance markers vs control
- **Purpose:** Direct comparison between conditions

---

### 5. Export System

#### PNG Export (300 DPI)
- Uses html2canvas library to capture the chart
- Scale factor of 3x produces ~300 DPI output
- Suitable for PowerPoint, Word, journal submissions

#### SVG Export (Vector)
- Extracts the actual SVG element from the chart
- Infinitely scalable without quality loss
- Editable in Adobe Illustrator
- Best for print publications

#### Background Themes

| Theme | Best For |
|-------|----------|
| **Dark** | Presentations on screens |
| **White** | Journal submissions, printing |
| **Black** | High contrast displays |

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                     │
└──────────────────────────────────────────────────────────────────────┘

  RAW FILE              PARSED                GROUPED              STATISTICS
  (.txt)                DATA                  BY CONDITION         
     │                    │                       │                    │
     ▼                    ▼                       ▼                    ▼
┌─────────┐         ┌─────────┐            ┌─────────┐          ┌─────────┐
│Elapsed  │         │wells:   │            │Control: │          │Mean     │
│B2  B3   │   →     │['B2'...]│     →      │ B2, B3  │    →     │SD, SEM  │
│0   0    │         │rawData: │            │Treatment│          │p-values │
│8   7    │         │{B2:[...]}│           │ C2, C3  │          │AUC      │
└─────────┘         └─────────┘            └─────────┘          └─────────┘
                                                                     │
                                                                     ▼
                                                              ┌─────────────┐
                                                              │ PUBLICATION │
                                                              │   FIGURES   │
                                                              │ + CSV DATA  │
                                                              └─────────────┘
```

---

## How to Explain This to Colleagues

### The 30-Second Pitch
> "This tool automates Incucyte scratch assay analysis. Upload your raw export, assign wells to conditions, and get publication-ready figures with statistics - including p-values and AUC - in about 2 minutes. It runs in any web browser, no software installation needed."

### The Technical Explanation
> "It's a React web application that parses Incucyte ZOOM exports, performs Welch's t-test for statistical comparison, calculates Area Under Curve for total efficacy, and exports 300 DPI figures in multiple formats. Statistics include mean, SD, SEM, and significance markers. You can choose white backgrounds for publications or dark for presentations."

### For the Methods Section
> "Wound healing data was analyzed using the Incucyte Wound Healing Analyzer web application. Relative Wound Density (%) values were exported from Incucyte ZOOM software and processed to calculate mean ± SEM for each condition. Statistical significance was determined using Welch's t-test (two-tailed), with significance thresholds of *p<0.05, **p<0.01, ***p<0.001. Area Under Curve (AUC) was calculated using the trapezoidal method to quantify cumulative wound healing."

---

## Quick Reference Card

```
┌────────────────────────────────────────────────────────────────┐
│              INCUCYTE ANALYZER QUICK REFERENCE                  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WORKFLOW:  Upload → Map Wells → Review → Export                │
│                                                                 │
│  STATISTICS PROVIDED:                                           │
│  • Mean, SD, SEM for each condition                            │
│  • Welch's t-test (p-values vs control)                        │
│  • Significance markers (*, **, ***)                           │
│  • Area Under Curve (AUC) with relative %                      │
│                                                                 │
│  EXPORT OPTIONS:                                                │
│  • PNG 300 DPI (presentations, documents)                      │
│  • SVG Vector (print, Illustrator editing)                     │
│  • CSV (raw data + statistics for GraphPad)                    │
│                                                                 │
│  BACKGROUND THEMES:                                             │
│  • White (journal submission)                                  │
│  • Dark (presentations)                                        │
│  • Black (high contrast)                                       │
│                                                                 │
│  OUTLIER HANDLING:                                              │
│  • Optional min/max removal                                    │
│  • Manual well exclusion by clicking                           │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Technical Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 19 | UI components and state management |
| Build Tool | Vite | Fast development and production builds |
| Charts | Recharts | Line and bar chart visualization |
| Export | html2canvas | PNG screenshot generation |
| Hosting | GitHub Pages | Free static site hosting |

---

## Expected Data Format

The analyzer expects tab-separated files with:
- Header row containing well identifiers (B2, C3, etc.)
- "Elapsed" column with time in hours
- Data values as Relative Wound Density (%)

Example:
```
Date Time	Elapsed	: B2, Image 1	: B3, Image 1	...
2024-01-16 10:28:00	0	0	0	...
2024-01-16 12:28:00	2	8.44	7.16	...
2024-01-16 14:28:00	4	15.2	14.8	...
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| File won't parse | Ensure it's a tab-separated export from Incucyte ZOOM |
| No wells detected | Check that well names follow A1-H12 format |
| Statistics show N=0 | Make sure wells are assigned to conditions |
| Export is blank | Wait for chart to fully render before exporting |

---

## License

MIT License - Free to use, modify, and distribute.

---

*Made for the cell biology research community*
