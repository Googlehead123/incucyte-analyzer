import React, { useState, useCallback, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import UploadStep from './components/analyzer/UploadStep';
import PlateMapStep from './components/analyzer/PlateMapStep';
import ReviewStep from './components/analyzer/ReviewStep';
import ResultsStep from './components/analyzer/ResultsStep';
import { CONDITION_COLORS, CHART_THEMES } from './utils/constants';
import { parseIncucyteData } from './utils/statistics';
import { runAnalysis, keyOf, OUTLIER_LABELS } from './utils/analysis';
import { evaluateWells, countBySeverity, detectScanFailures } from './utils/qc';
import { buildAnalysisCsv } from './utils/exportCsv';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <div style={{ textAlign: 'center', maxWidth: '480px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>Something went wrong</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#0891b2', color: 'white', fontWeight: '500', cursor: 'pointer' }}>
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [step, setStep] = useState(1);
  const [rawData, setRawData] = useState(null);
  const [wells, setWells] = useState([]);
  const [timepoints, setTimepoints] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [excludedWells, setExcludedWells] = useState(new Set());
  const [outlierMethod, setOutlierMethod] = useState('none');
  // Default 'none' so analyses produced before this option existed reproduce exactly.
  const [correctionMethod, setCorrectionMethod] = useState('none');
  const [errorBarType, setErrorBarType] = useState('sem');
  const [selectedTimepoint, setSelectedTimepoint] = useState(24);
  const [processedData, setProcessedData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [activeConditionIdx, setActiveConditionIdx] = useState(0);
  const [controlConditionIdx, setControlConditionIdx] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [chartTheme, setChartTheme] = useState('dark');
  const [appError, setAppError] = useState(null);

  const [figureTitle, setFigureTitle] = useState('Wound Healing Assay Results');
  const [xAxisLabel, _setXAxisLabel] = useState('Time (hours)');
  const [yAxisLabel, _setYAxisLabel] = useState('Relative Wound Density (%)');

  const [timeCourseEndpoint, setTimeCourseEndpoint] = useState(null);
  // 'full' keeps 0-100% on screen — the wound's natural range — so plots from
  // different experiments are comparable. 'fit' zooms to the data for a weak
  // effect that would otherwise sit flat along the bottom of the axis.
  const [yAxisScale, setYAxisScale] = useState('full');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [draggedConditionIdx, setDraggedConditionIdx] = useState(null);
  const [dragOverConditionIdx, setDragOverConditionIdx] = useState(null);

  const fileInputRef = useRef(null);
  const timeCourseRef = useRef(null);
  const barChartRef = useRef(null);
  const dragHandledRef = useRef(false);

  const theme = CHART_THEMES[chartTheme];

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setAppError(null);
    const reader = new FileReader();
    reader.onerror = () => {
      setAppError(`Could not read "${file.name}". The file may be locked by another program or on an unavailable drive.`);
    };
    reader.onload = (e) => {
      try {
        const result = parseIncucyteData(e.target.result);
        // A header with no data rows parses "successfully" but leaves nothing to
        // analyse; catch it here rather than letting the timepoint picker below
        // fail on an empty array with an opaque message.
        if (result.timepoints.length === 0) {
          throw new Error('The header row was found but the file contains no data rows.');
        }
        setRawData(result.rawData);
        setWells(result.wells);
        setTimepoints(result.timepoints);
        setConditions([
          { id: 1, name: 'Control', color: CONDITION_COLORS[0], wells: [] },
          { id: 2, name: 'Treatment', color: CONDITION_COLORS[1], wells: [] }
        ]);
        setExcludedWells(new Set());
        setControlConditionIdx(0);
        setProcessedData(null);
        setTimeCourseEndpoint(null);
        setActiveConditionIdx(0);
        const maxTime = Math.max(...result.timepoints);
        const targetTime = Math.min(maxTime, 24);
        const nearest = result.timepoints.reduce((prev, curr) =>
          Math.abs(curr - targetTime) < Math.abs(prev - targetTime) ? curr : prev
        );
        setSelectedTimepoint(nearest);
        setStep(2);
      } catch (error) {
        setAppError(`Error parsing file: ${error.message}`);
      }
    };
    reader.readAsText(file);
  }, []);

  const addCondition = useCallback(() => {
    const newId = Math.max(...conditions.map(c => c.id), 0) + 1;
    setConditions([...conditions, {
      id: newId,
      name: `Treatment ${newId}`,
      color: CONDITION_COLORS[conditions.length % CONDITION_COLORS.length],
      wells: []
    }]);
    setActiveConditionIdx(conditions.length);
  }, [conditions]);

  const removeCondition = useCallback((index) => {
    if (conditions.length <= 1) return;
    setConditions(conditions.filter((_, i) => i !== index));
    setActiveConditionIdx(Math.max(0, activeConditionIdx - 1));
    if (controlConditionIdx >= index) setControlConditionIdx(Math.max(0, controlConditionIdx - 1));
  }, [conditions, activeConditionIdx, controlConditionIdx]);

  const updateCondition = useCallback((index, updates) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  }, [conditions]);

  const assignWellToCondition = useCallback((well, conditionIndex) => {
    setConditions(conditions.map((c, i) => ({
      ...c,
      wells: i === conditionIndex
        ? (c.wells.includes(well) ? c.wells.filter(w => w !== well) : [...c.wells, well])
        : c.wells.filter(w => w !== well)
    })));
  }, [conditions]);

  const assignRowToCondition = useCallback((row, conditionIndex, colStart, colEnd) => {
    setConditions(conditions.map((c, i) => {
      const rowWells = Array.from({length: colEnd - colStart + 1}, (_, idx) => `${row}${colStart + idx}`)
        .filter(w => wells.includes(w));
      if (i === conditionIndex) return { ...c, wells: [...new Set([...c.wells, ...rowWells])] };
      return { ...c, wells: c.wells.filter(w => !rowWells.includes(w)) };
    }));
  }, [conditions, wells]);

  const assignColumnToCondition = useCallback((col, conditionIndex, rowStart, rowEnd) => {
    setConditions(conditions.map((c, i) => {
      const colWells = [];
      for (let r = rowStart.charCodeAt(0); r <= rowEnd.charCodeAt(0); r++) {
        const wellName = `${String.fromCharCode(r)}${col}`;
        if (wells.includes(wellName)) colWells.push(wellName);
      }
      if (i === conditionIndex) return { ...c, wells: [...new Set([...c.wells, ...colWells])] };
      return { ...c, wells: c.wells.filter(w => !colWells.includes(w)) };
    }));
  }, [conditions, wells]);

  const parseWell = useCallback((well) => {
    if (!well) return null;
    const row = well.charAt(0);
    const col = parseInt(well.slice(1), 10);
    return { row, col, rowIdx: row.charCodeAt(0) - 65 };
  }, []);

  const getWellsInRect = useCallback((startWell, endWell) => {
    const start = parseWell(startWell);
    const end = parseWell(endWell);
    if (!start || !end) return [];

    const minRow = Math.min(start.rowIdx, end.rowIdx);
    const maxRow = Math.max(start.rowIdx, end.rowIdx);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const selectedWells = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const wellName = `${String.fromCharCode(65 + r)}${c}`;
        if (wells.includes(wellName)) {
          selectedWells.push(wellName);
        }
      }
    }
    return selectedWells;
  }, [parseWell, wells]);

  const assignWellsToCondition = useCallback((wellsToAssign, conditionIndex) => {
    if (!wellsToAssign || wellsToAssign.length === 0) return;
    setConditions(conditions.map((c, i) => {
      if (i === conditionIndex) {
        return { ...c, wells: [...new Set([...c.wells, ...wellsToAssign])] };
      }
      return { ...c, wells: c.wells.filter(w => !wellsToAssign.includes(w)) };
    }));
  }, [conditions]);

  const handleDragStart = useCallback((well) => {
    setIsDragging(true);
    setDragStart(well);
    setDragEnd(well);
  }, []);

  const handleDragEnter = useCallback((well) => {
    if (isDragging) {
      setDragEnd(well);
    }
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (isDragging && dragStart && dragEnd) {
      const selectedWells = getWellsInRect(dragStart, dragEnd);
      if (selectedWells.length === 1) {
        // Single-well click: toggle instead of always adding
        assignWellToCondition(selectedWells[0], activeConditionIdx);
      } else {
        assignWellsToCondition(selectedWells, activeConditionIdx);
      }
      // Prevent the subsequent click event from double-firing
      dragHandledRef.current = true;
      requestAnimationFrame(() => { dragHandledRef.current = false; });
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, getWellsInRect, assignWellToCondition, assignWellsToCondition, activeConditionIdx]);

  const dragSelectedWells = useMemo(() => {
    if (!isDragging || !dragStart || !dragEnd) return new Set();
    return new Set(getWellsInRect(dragStart, dragEnd));
  }, [isDragging, dragStart, dragEnd, getWellsInRect]);

  const reorderConditions = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const newConditions = [...conditions];
    const [moved] = newConditions.splice(fromIdx, 1);
    newConditions.splice(toIdx, 0, moved);
    setConditions(newConditions);

    if (activeConditionIdx === fromIdx) {
      setActiveConditionIdx(toIdx);
    } else if (fromIdx < activeConditionIdx && toIdx >= activeConditionIdx) {
      setActiveConditionIdx(activeConditionIdx - 1);
    } else if (fromIdx > activeConditionIdx && toIdx <= activeConditionIdx) {
      setActiveConditionIdx(activeConditionIdx + 1);
    }

    if (controlConditionIdx === fromIdx) {
      setControlConditionIdx(toIdx);
    } else if (fromIdx < controlConditionIdx && toIdx >= controlConditionIdx) {
      setControlConditionIdx(controlConditionIdx - 1);
    } else if (fromIdx > controlConditionIdx && toIdx <= controlConditionIdx) {
      setControlConditionIdx(controlConditionIdx + 1);
    }
  }, [conditions, activeConditionIdx, controlConditionIdx]);

  const getWellCondition = useCallback((well) => {
    for (let i = 0; i < conditions.length; i++) {
      if (conditions[i].wells.includes(well)) return { index: i, ...conditions[i] };
    }
    return null;
  }, [conditions]);

  const toggleExcludedWell = useCallback((well) => {
    setExcludedWells(prev => {
      const next = new Set(prev);
      next.has(well) ? next.delete(well) : next.add(well);
      return next;
    });
  }, []);

  // Advisory QC across every assigned well. Recomputed only when the data or the
  // assignment changes; excluded wells stay in the report so the reason a well
  // was dropped remains visible (and lands in the export).
  const qcReport = useMemo(() => {
    if (!rawData || timepoints.length === 0) return {};
    const assigned = [...new Set(conditions.flatMap(c => c.wells))];
    return evaluateWells(assigned, rawData, timepoints);
  }, [rawData, conditions, timepoints]);

  const qcCounts = useMemo(() => countBySeverity(qcReport), [qcReport]);

  // Plate-level: an anomaly shared by many wells at the same timepoint is a
  // failed scan. The fix is to drop that timepoint, not those wells.
  const scanFailures = useMemo(() => {
    if (!rawData || timepoints.length === 0) return [];
    const assigned = [...new Set(conditions.flatMap(c => c.wells))];
    return detectScanFailures(assigned, rawData, timepoints);
  }, [rawData, conditions, timepoints]);

  // Wells flagged high-severity that the user has not yet excluded.
  const unresolvedQcWells = useMemo(
    () => Object.entries(qcReport)
      .filter(([well, r]) => r.severity === 'high' && !excludedWells.has(well))
      .map(([well]) => well),
    [qcReport, excludedWells]
  );

  const excludeAllFlaggedWells = useCallback(() => {
    setExcludedWells(prev => {
      const next = new Set(prev);
      unresolvedQcWells.forEach(w => next.add(w));
      return next;
    });
  }, [unresolvedQcWells]);

  const getWellStats = useCallback((well) => {
    if (!rawData?.[well]) return null;
    const values = rawData[well].filter(v => v != null);
    return { finalValue: values[values.length - 1] || 0, maxValue: Math.max(...values), values };
  }, [rawData]);

  const processData = useCallback(() => {
    const results = runAnalysis({
      rawData, conditions, timepoints, excludedWells,
      outlierMethod, correctionMethod, selectedTimepoint, controlConditionIdx
    });
    if (!results) return;
    setProcessedData(results);
    setStep(4);
  }, [rawData, conditions, timepoints, excludedWells, outlierMethod, selectedTimepoint, controlConditionIdx, correctionMethod]);

  const barChartData = useMemo(() => {
    if (!processedData) return [];
    return conditions.map(condition => {
      const k = keyOf(condition);
      return {
        name: condition.name,
        // Distinguish duplicate display names on the axis so two bars labelled
        // the same are still tellable apart.
        key: k,
        value: processedData.statistics[k]?.mean || 0,
        error: processedData.statistics[k]?.[errorBarType] || 0,
        fill: condition.color,
        pValue: processedData.pValues[k]?.p ?? null,
        significance: processedData.pValues[k]?.stars || 'ns',
        n: processedData.statistics[k]?.n || 0
      };
    });
  }, [processedData, conditions, errorBarType]);

  const filteredTimeCourse = useMemo(() => {
    if (!processedData) return [];
    if (timeCourseEndpoint === null) return processedData.timeCourse;
    return processedData.timeCourse.filter(row => row.time <= timeCourseEndpoint);
  }, [processedData, timeCourseEndpoint]);

  const exportToPNG = useCallback(async (elementRef, filename) => {
    if (!elementRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(elementRef.current, {
        scale: 3,
        backgroundColor: theme.background,
        logging: false,
        useCORS: true
      });
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) {
      setAppError(`Export failed: ${err.message}`);
    }
    setIsExporting(false);
  }, [theme]);

  const exportToCSV = useCallback(() => {
    if (!processedData) return;
    const csv = buildAnalysisCsv({
      processedData,
      conditions,
      timepoints,
      rawData,
      excludedWells,
      selectedTimepoint,
      outlierMethod: OUTLIER_LABELS[outlierMethod] || outlierMethod,
      correctionMethod: processedData.correctionMethod,
      qcReport,
      keyOf
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}_analyzed.csv`;
    link.click();
    // Without this the blob is pinned for the lifetime of the tab; a few dozen
    // exports in one session is a real leak.
    URL.revokeObjectURL(url);
  }, [processedData, conditions, fileName, selectedTimepoint, rawData, timepoints, excludedWells, outlierMethod, qcReport]);

  const plateGrid = useMemo(() => ({
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    cols: Array.from({ length: 12 }, (_, i) => i + 1)
  }), []);

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      color: '#f1f5f9',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    },
    maxWidth: { maxWidth: '1400px', margin: '0 auto', padding: '24px' },
    card: {
      backgroundColor: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #334155'
    },
    chartCard: {
      backgroundColor: theme.cardBg,
      borderRadius: '12px',
      padding: '24px',
      border: theme.background === '#ffffff' ? '1px solid #e5e7eb' : '1px solid #334155'
    },
    button: { padding: '10px 20px', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', border: 'none' },
    primaryButton: { backgroundColor: '#0891b2', color: 'white' },
    secondaryButton: { backgroundColor: '#334155', color: '#e2e8f0' }
  };

  return (
    <ErrorBoundary>
      <div style={styles.container}>
        <div style={styles.maxWidth}>
          <header style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Incucyte Wound Healing Analyzer</h1>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Publication-Ready Analysis & Export</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {[{ num: 1, label: 'Upload' }, { num: 2, label: 'Map Wells' }, { num: 3, label: 'Review' }, { num: 4, label: 'Results' }].map((s, i) => (
                <React.Fragment key={s.num}>
                  <button onClick={() => s.num <= step && setStep(s.num)} disabled={s.num > step}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '20px', fontSize: '13px',
                      border: `1px solid ${step >= s.num ? '#0891b2' : '#334155'}`,
                      backgroundColor: step === s.num ? 'rgba(8, 145, 178, 0.2)' : 'transparent',
                      color: step >= s.num ? '#22d3ee' : '#64748b', cursor: s.num <= step ? 'pointer' : 'default' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                      backgroundColor: step >= s.num ? '#0891b2' : '#334155', color: step >= s.num ? 'white' : '#64748b' }}>{s.num}</span>
                    {s.label}
                  </button>
                  {i < 3 && <div style={{ width: '24px', height: '2px', backgroundColor: step > s.num ? 'rgba(8, 145, 178, 0.5)' : '#334155' }} />}
                </React.Fragment>
              ))}
            </div>
          </header>

          {appError && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{appError}</span>
              <button onClick={() => setAppError(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>×</button>
            </div>
          )}

          {step === 1 && (
            <UploadStep
              fileInputRef={fileInputRef}
              handleFileUpload={handleFileUpload}
              styles={styles}
            />
          )}

          {step === 2 && (
            <PlateMapStep
              conditions={conditions}
              activeConditionIdx={activeConditionIdx}
              setActiveConditionIdx={setActiveConditionIdx}
              controlConditionIdx={controlConditionIdx}
              setControlConditionIdx={setControlConditionIdx}
              addCondition={addCondition}
              removeCondition={removeCondition}
              updateCondition={updateCondition}
              assignWellToCondition={assignWellToCondition}
              assignRowToCondition={assignRowToCondition}
              assignColumnToCondition={assignColumnToCondition}
              reorderConditions={reorderConditions}
              getWellCondition={getWellCondition}
              wells={wells}
              excludedWells={excludedWells}
              isDragging={isDragging}
              dragSelectedWells={dragSelectedWells}
              handleDragStart={handleDragStart}
              handleDragEnter={handleDragEnter}
              handleDragEnd={handleDragEnd}
              draggedConditionIdx={draggedConditionIdx}
              setDraggedConditionIdx={setDraggedConditionIdx}
              dragOverConditionIdx={dragOverConditionIdx}
              setDragOverConditionIdx={setDragOverConditionIdx}
              dragHandledRef={dragHandledRef}
              plateGrid={plateGrid}
              setStep={setStep}
              styles={styles}
            />
          )}

          {step === 3 && (
            <ReviewStep
              conditions={conditions}
              excludedWells={excludedWells}
              toggleExcludedWell={toggleExcludedWell}
              getWellStats={getWellStats}
              outlierMethod={outlierMethod}
              setOutlierMethod={setOutlierMethod}
              correctionMethod={correctionMethod}
              setCorrectionMethod={setCorrectionMethod}
              errorBarType={errorBarType}
              setErrorBarType={setErrorBarType}
              selectedTimepoint={selectedTimepoint}
              setSelectedTimepoint={setSelectedTimepoint}
              timepoints={timepoints}
              qcReport={qcReport}
              qcCounts={qcCounts}
              scanFailures={scanFailures}
              unresolvedQcWells={unresolvedQcWells}
              excludeAllFlaggedWells={excludeAllFlaggedWells}
              figureTitle={figureTitle}
              setFigureTitle={setFigureTitle}
              controlConditionIdx={controlConditionIdx}
              processData={processData}
              setStep={setStep}
              styles={styles}
            />
          )}

          {step === 4 && processedData && (
            <ResultsStep
              processedData={processedData}
              conditions={conditions}
              timepoints={timepoints}
              selectedTimepoint={selectedTimepoint}
              errorBarType={errorBarType}
              outlierMethod={outlierMethod}
              keyOf={keyOf}
              qcReport={qcReport}
              figureTitle={figureTitle}
              xAxisLabel={xAxisLabel}
              yAxisLabel={yAxisLabel}
              chartTheme={chartTheme}
              setChartTheme={setChartTheme}
              showExportPanel={showExportPanel}
              setShowExportPanel={setShowExportPanel}
              isExporting={isExporting}
              exportToPNG={exportToPNG}
              exportToCSV={exportToCSV}
              fileName={fileName}
              timeCourseRef={timeCourseRef}
              barChartRef={barChartRef}
              barChartData={barChartData}
              filteredTimeCourse={filteredTimeCourse}
              timeCourseEndpoint={timeCourseEndpoint}
              setTimeCourseEndpoint={setTimeCourseEndpoint}
              yAxisScale={yAxisScale}
              setYAxisScale={setYAxisScale}
              setStep={setStep}
              styles={styles}
            />
          )}

          <footer style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px solid rgba(51, 65, 85, 0.5)', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#64748b' }}>Incucyte Wound Healing Analyzer • Publication-Ready Edition</p>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
