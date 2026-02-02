# Best Triplicate Selection & Representative Well Output

## TL;DR

> **Quick Summary**: Add a "best triplicate" outlier removal option in Review settings and show a representative well per condition in Results output.
> 
> **Deliverables**:
> - 3-option outlier selector replacing the current checkbox (None / Min-Max / Best Triplicate)
> - `selectBestTriplicate()` algorithm that picks 3 wells with smallest variance at endpoint timepoint
> - Representative well per condition displayed in statistics table + CSV export
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: NO - sequential (Task 2 depends on Task 1's refactored processData)
> **Critical Path**: Task 1 → Task 2 → Task 3

---

## Context

### Original Request
Add a "best triplicate average" button in the Review section that selects the 3 wells with smallest variance from each sample/condition. Add representative well output in Results showing which specific well from each condition is closest to the calculated average at the selected endpoint timepoint.

### Interview Summary
**Key Discussions**:
- User wants seamless, error-free analysis
- Two distinct features that work together within existing architecture

**Research Findings**:
- Single-file React app (`src/App.jsx`, 1250 lines), no test infrastructure
- Current outlier removal: `autoRemoveMinMax` boolean → `removeMinMax()` strips min/max values per-timepoint
- `processData()` applies outlier removal at 3 sites (lines 553, 571, 578) — all per-timepoint
- Results section: time course chart, bar chart, statistics table, AUC, data table, CSV export

### Metis Review
**Identified Gaps** (addressed):
- **Structural mismatch**: bestTriplicate selects *wells* (not values), so it must select once per condition BEFORE the timepoint loop, unlike per-timepoint minmax removal. Resolved: refactor processData to pre-filter wells for bestTriplicate mode.
- **Edge cases**: Conditions with ≤3 wells → bestTriplicate returns all available wells (no filtering needed).
- **Variance definition**: Use sample variance (n-1 denominator) consistent with existing `calculateStats`.
- **Best triplicate selection basis**: Use variance at the selected endpoint timepoint (matches the per-timepoint philosophy and is computationally simple).
- **Representative well scope**: Identified at endpoint timepoint using post-outlier-removal mean, searching among all non-excluded wells (not just surviving outlier filter).

---

## Work Objectives

### Core Objective
Replace the binary outlier checkbox with a 3-option selector and add representative well identification to results output.

### Concrete Deliverables
- New `selectBestTriplicate(wells, rawData, timeIdx)` utility function
- `outlierMethod` state replacing `autoRemoveMinMax`
- 3-button selector UI in Review settings panel
- Refactored `processData()` with pre-filtering for bestTriplicate mode
- Representative well calculation and storage in `processedData`
- Representative well column in statistics table
- Representative well row in CSV export

### Definition of Done
- [ ] `npx vite build` succeeds with zero errors
- [ ] All 3 outlier modes produce correct results
- [ ] Representative well appears in statistics table and CSV for every condition
- [ ] Existing 'none' and 'minmax' behavior unchanged

### Must Have
- 3-option outlier selector: None, Remove Min/Max, Best Triplicate
- Best triplicate selects exactly 3 wells with smallest variance at endpoint timepoint
- Representative well shown per condition in Results
- Representative well included in CSV export

### Must NOT Have (Guardrails)
- Do NOT modify `calculateStats`, `tTest`, `calculateAUC`, or `removeMinMax` functions
- Do NOT add new files, components, or npm dependencies
- Do NOT restructure the CSV format beyond adding representative well info
- Do NOT redesign the Review section layout — only replace the checkbox with a selector
- Do NOT change the `processData` dependency array beyond replacing `autoRemoveMinMax` with `outlierMethod`

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO
- **User wants tests**: Manual verification
- **Framework**: none

### Automated Verification

Each TODO includes executable verification via `npx vite build` for compilation and Playwright browser automation for functional correctness.

---

## Execution Strategy

### Sequential Execution

```
Task 1: Outlier method selector + bestTriplicate algorithm + processData refactor
    ↓
Task 2: Representative well calculation + Results display + CSV export
    ↓
Task 3: Integration verification and edge case testing
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|------------|--------|
| 1 | None | 2, 3 |
| 2 | 1 | 3 |
| 3 | 1, 2 | None |

---

## TODOs

- [ ] 1. Replace outlier checkbox with 3-option selector and implement bestTriplicate algorithm

  **What to do**:

  1. Add new utility function `selectBestTriplicate(wells, rawData, timeIdx)` after `removeMinMax` (after line 129):
     - Takes array of well names, rawData object, and timepoint index
     - If `wells.length <= 3`, return all wells
     - Generate all C(N,3) combinations of wells
     - For each combination, get the 3 values at `timeIdx` from `rawData`
     - Calculate variance of the 3 values (sample variance, n-1 denominator)
     - Return the combination with smallest variance
     - Return value: array of 3 well name strings

  2. Replace state `autoRemoveMinMax` (line 330) with `outlierMethod`:
     ```javascript
     const [outlierMethod, setOutlierMethod] = useState('none');
     ```

  3. Refactor `processData()` (line 537):
     - Before the timepoints loop, for each condition, compute filtered wells:
       ```javascript
       const conditionFilteredWells = {};
       const selectedIdx = timepoints.findIndex(t => t === selectedTimepoint);
       conditions.forEach(condition => {
         const activeWells = condition.wells.filter(well => !excludedWells.has(well));
         if (outlierMethod === 'bestTriplicate' && activeWells.length > 3 && selectedIdx >= 0) {
           conditionFilteredWells[condition.name] = selectBestTriplicate(activeWells, rawData, selectedIdx);
         } else {
           conditionFilteredWells[condition.name] = activeWells;
         }
       });
       ```
     - Inside the timepoints loop (line 548), replace per-condition well filtering:
       ```javascript
       // For bestTriplicate: use pre-selected wells (no per-timepoint filtering)
       // For minmax: use all active wells then apply removeMinMax on values
       // For none: use all active wells directly
       ```
     - Line 553 area: Get values from `conditionFilteredWells[condition.name]` when bestTriplicate, otherwise from active wells. Apply `removeMinMax` only when `outlierMethod === 'minmax'`.
     - Lines 567-578 (endpoint statistics): Same pattern — use conditionFilteredWells for bestTriplicate, apply removeMinMax for minmax.
     - Update `processData` dependency array: replace `autoRemoveMinMax` with `outlierMethod`

  4. Replace the checkbox UI (lines 979-985) with a 3-button selector:
     - Follow the existing pattern of the SEM/SD buttons (lines 989-998)
     - Three buttons: "None", "Min/Max", "Best Triplicate"
     - Active button highlighted with `#0891b2`, inactive with `#334155`
     - Add subtitle text: "Best Triplicate: selects 3 wells with smallest variance"

  5. Update the results summary text (line 1208) to show the selected outlier method name instead of On/Off

  **Must NOT do**:
  - Do not modify `removeMinMax`, `calculateStats`, `tTest`, or `calculateAUC`
  - Do not change any other state variables
  - Do not add new dependencies

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Structural refactor of core data pipeline requires careful logic
  - **Skills**: [`playwright`]
    - `playwright`: Needed for browser-based functional verification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (first task)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/App.jsx:124-129` — `removeMinMax` function: pattern for utility function placement and style
  - `src/App.jsx:330` — `autoRemoveMinMax` state declaration: replace this line
  - `src/App.jsx:537-598` — `processData` function: the main pipeline to refactor. Contains 3 outlier application sites at lines 553, 571, 578
  - `src/App.jsx:989-998` — SEM/SD button selector UI: exact pattern to follow for the 3-option outlier selector
  - `src/App.jsx:979-985` — Current checkbox to replace

  **API/Type References**:
  - `rawData[well][timeIdx]` — how to access a specific well's value at a timepoint
  - `condition.wells` — array of well name strings like `["A1", "A2", "A3", "B1"]`
  - `excludedWells` — Set of well names to filter out before any processing

  **WHY Each Reference Matters**:
  - Lines 124-129: Shows the function signature pattern for utility functions (takes values array, returns filtered array). The new function follows this pattern but takes wells + rawData + timeIdx and returns well names.
  - Lines 537-598: This is THE function being modified. All 3 sites where outlier removal is applied must be updated consistently. The structural change is: bestTriplicate must pre-compute filtered wells BEFORE the timepoint loop, unlike minmax which filters values inside the loop.
  - Lines 989-998: The exact UI pattern to replicate — button group with active/inactive styling using `#0891b2`/`#334155` background colors.

  **Acceptance Criteria**:

  ```bash
  # Build succeeds
  npx vite build
  # Assert: Exit code 0, no errors
  ```

  ```
  # Agent executes via playwright browser automation:
  1. Run: npx vite dev (background)
  2. Navigate to: http://localhost:5173
  3. Upload a test data file
  4. Map wells to 2 conditions (4+ wells each)
  5. Click "Continue to Review"
  6. Verify: 3 outlier buttons visible ("None", "Min/Max", "Best Triplicate")
  7. Click "None" → Click "Analyze" → Note N value in statistics table
  8. Go back → Click "Min/Max" → Click "Analyze" → Verify N decreased by 2
  9. Go back → Click "Best Triplicate" → Click "Analyze" → Verify N = 3
  10. Screenshot: .sisyphus/evidence/task-1-outlier-selector.png
  ```

  **Commit**: YES
  - Message: `feat(review): replace outlier checkbox with 3-option selector and add best triplicate algorithm`
  - Files: `src/App.jsx`
  - Pre-commit: `npx vite build`

---

- [ ] 2. Add representative well calculation and display in Results

  **What to do**:

  1. In `processData()`, after computing endpoint statistics (after line 583), calculate representative wells:
     ```javascript
     results.representativeWells = {};
     if (selectedIdx >= 0) {
       conditions.forEach(condition => {
         const activeWells = condition.wells.filter(well => !excludedWells.has(well));
         const condMean = results.statistics[condition.name]?.mean;
         if (condMean === undefined || activeWells.length === 0) return;
         
         let closestWell = null;
         let closestDiff = Infinity;
         activeWells.forEach(well => {
           const val = rawData[well]?.[selectedIdx];
           if (val === null || val === undefined || isNaN(val)) return;
           const diff = Math.abs(val - condMean);
           if (diff < closestDiff) {
             closestDiff = diff;
             closestWell = well;
           }
         });
         
         if (closestWell) {
           results.representativeWells[condition.name] = {
             well: closestWell,
             value: rawData[closestWell][selectedIdx]
           };
         }
       });
     }
     ```

  2. Add "Rep. Well" column to the statistics table (lines 1157-1188):
     - Add header: `<th>Rep. Well</th>` after the Sig. column
     - Add cell per row: Display well name and its value, e.g., `A3 (45.2%)`

  3. Add representative well to CSV export (line 663-668):
     - Add `Representative Well,Rep. Well Value` columns to endpoint statistics header
     - Add corresponding values per condition row

  **Must NOT do**:
  - Do not add a new section or card — integrate into existing statistics table
  - Do not change any chart components
  - Do not modify the time course data table

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Additive feature, no structural changes, straightforward data flow
  - **Skills**: [`playwright`]
    - `playwright`: Browser verification of new table column

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 1)
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/App.jsx:566-583` — Endpoint statistics calculation block: add representative well calc after this
  - `src/App.jsx:1157-1188` — Statistics table: add new column here
  - `src/App.jsx:663-668` — CSV endpoint statistics: add new columns here

  **API/Type References**:
  - `processedData.statistics[condition.name]` — has `.mean` property used as comparison target
  - `rawData[well][selectedIdx]` — individual well value at endpoint
  - `condition.wells` — full list of wells for the condition

  **WHY Each Reference Matters**:
  - Lines 566-583: Where endpoint stats are computed. Representative well logic goes right after because it needs the computed mean.
  - Lines 1157-1188: The exact table to add the column to. Follow the existing `<th>/<td>` pattern with same styling.
  - Lines 663-668: CSV format to extend. Add 2 new columns at the end of each row.

  **Acceptance Criteria**:

  ```bash
  npx vite build
  # Assert: Exit code 0
  ```

  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173
  2. Upload test data, map wells, review, analyze
  3. In Results: Verify statistics table has "Rep. Well" column
  4. Verify each condition row shows a well identifier (e.g., "A3") with a value
  5. Export CSV → Read file → Verify "Representative Well" column exists in endpoint statistics
  6. Screenshot: .sisyphus/evidence/task-2-representative-well.png
  ```

  **Commit**: YES
  - Message: `feat(results): add representative well per condition in statistics table and CSV export`
  - Files: `src/App.jsx`
  - Pre-commit: `npx vite build`

---

- [ ] 3. Integration verification and edge case testing

  **What to do**:

  1. Test edge cases via browser:
     - Condition with exactly 3 wells + bestTriplicate → N should be 3, same as all wells
     - Condition with 2 wells + bestTriplicate → should use all 2 wells (no filtering)
     - Condition with 1 well → representative well = that well
     - Switch between all 3 outlier methods rapidly → no crashes
     - Representative well displays correctly for all outlier methods (none, minmax, bestTriplicate)

  2. Verify backward compatibility:
     - "None" mode produces identical results to the old app with checkbox unchecked
     - "Min/Max" mode produces identical results to the old app with checkbox checked

  3. Test CSV export with all 3 modes — verify format is correct and parseable

  **Must NOT do**:
  - Do not make code changes unless a bug is found
  - If a bug is found, fix it minimally

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification-only task, no implementation
  - **Skills**: [`playwright`]
    - `playwright`: All verification is browser-based

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final task)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/App.jsx:46-54` — `calculateStats`: verify N values match expected counts
  - `src/App.jsx:124-129` — `removeMinMax`: verify minmax mode behavior unchanged

  **Acceptance Criteria**:

  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173
  2. Upload test data file
  3. Map 4+ wells to "Control", 4+ wells to "Treatment"
  4. Review → Select "None" → Analyze → Record Control N and Mean
  5. Back → Select "Min/Max" → Analyze → Verify N = original - 2, record Mean
  6. Back → Select "Best Triplicate" → Analyze → Verify N = 3, record Mean
  7. Verify representative well shown for each condition in all 3 modes
  8. Export CSV → Verify representative well data present
  9. Back → Map only 2 wells to a new condition → Best Triplicate → Analyze → Verify no crash, N = 2
  10. Screenshot: .sisyphus/evidence/task-3-edge-cases.png
  ```

  **Commit**: NO (verification only, unless bug fix needed)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(review): replace outlier checkbox with 3-option selector and add best triplicate algorithm` | src/App.jsx | `npx vite build` |
| 2 | `feat(results): add representative well per condition in statistics table and CSV export` | src/App.jsx | `npx vite build` |
| 3 | No commit (verification only) | — | Browser testing |

---

## Success Criteria

### Verification Commands
```bash
npx vite build  # Expected: Build succeeds, zero errors
```

### Final Checklist
- [ ] 3-option outlier selector visible in Review settings
- [ ] "Best Triplicate" correctly selects 3 wells with smallest variance
- [ ] "None" and "Min/Max" produce identical results to previous behavior
- [ ] Representative well shown per condition in statistics table
- [ ] Representative well included in CSV export
- [ ] Edge cases (≤3 wells, 1 well, rapid switching) handled gracefully
- [ ] No new dependencies added
- [ ] No existing functions modified (calculateStats, tTest, calculateAUC, removeMinMax)
