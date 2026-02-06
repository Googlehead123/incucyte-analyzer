import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';
import UploadStep from './components/analyzer/UploadStep';
import PlateMapStep from './components/analyzer/PlateMapStep';
import ReviewStep from './components/analyzer/ReviewStep';
import ResultsStep from './components/analyzer/ResultsStep';
import { CONDITION_COLORS, CHART_THEMES } from './utils/constants';
import { calculateStats, tTest, calculateAUC, removeMinMax, selectBestTriplicate, parseIncucyteData } from './utils/statistics';
import { supabase } from './lib/supabase';
import { useAuth } from './contexts/AuthContext';

function App() {
  const location = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [experimentId, setExperimentId] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [wells, setWells] = useState([]);
  const [timepoints, setTimepoints] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [excludedWells, setExcludedWells] = useState(new Set());
  const [outlierMethod, setOutlierMethod] = useState('none');
  const [errorBarType, setErrorBarType] = useState('sem');
  const [selectedTimepoint, setSelectedTimepoint] = useState(24);
  const [processedData, setProcessedData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [activeConditionIdx, setActiveConditionIdx] = useState(0);
  const [controlConditionIdx, setControlConditionIdx] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [chartTheme, setChartTheme] = useState('dark');
  
  const [figureTitle, setFigureTitle] = useState('Wound Healing Assay Results');
  const [xAxisLabel, setXAxisLabel] = useState('Time (hours)');
  const [yAxisLabel, setYAxisLabel] = useState('Relative Wound Density (%)');
  
  const [timeCourseEndpoint, setTimeCourseEndpoint] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [draggedConditionIdx, setDraggedConditionIdx] = useState(null);
  const [dragOverConditionIdx, setDragOverConditionIdx] = useState(null);
  
  const fileInputRef = useRef(null);
  const timeCourseRef = useRef(null);
  const barChartRef = useRef(null);
  
  const theme = CHART_THEMES[chartTheme];

  useEffect(() => {
    const loadedExperiment = location.state?.experiment;
    if (loadedExperiment) {
      setExperimentId(loadedExperiment.id);
      setFileName(loadedExperiment.file_name || '');
      setRawData(loadedExperiment.raw_data);
      setTimepoints(loadedExperiment.timepoints);
      setConditions(loadedExperiment.conditions);
      setExcludedWells(new Set(loadedExperiment.excluded_wells || []));
      setOutlierMethod(loadedExperiment.settings?.outlierMethod || 'none');
      setErrorBarType(loadedExperiment.settings?.errorBarType || 'sem');
      setSelectedTimepoint(loadedExperiment.settings?.selectedTimepoint || 24);
      setControlConditionIdx(loadedExperiment.settings?.controlConditionIdx || 0);
      setFigureTitle(loadedExperiment.settings?.figureTitle || 'Wound Healing Assay Results');
      setXAxisLabel(loadedExperiment.settings?.xAxisLabel || 'Time (hours)');
      setYAxisLabel(loadedExperiment.settings?.yAxisLabel || 'Relative Wound Density (%)');
      setStep(4);
    }
  }, [location.state]);

  const saveExperiment = async () => {
    if (!user) {
      alert('Please sign in to save experiments');
      return;
    }

    const name = prompt('Enter experiment name:', fileName || 'Untitled Experiment');
    if (!name) return;

    try {
      const experimentData = {
        user_id: user.id,
        name,
        file_name: fileName,
        raw_data: rawData,
        timepoints,
        conditions,
        excluded_wells: Array.from(excludedWells),
        processed_data: processedData,
        settings: {
          outlierMethod,
          errorBarType,
          selectedTimepoint,
          controlConditionIdx,
          figureTitle,
          xAxisLabel,
          yAxisLabel,
        },
      };

      if (experimentId) {
        const { error } = await supabase
          .from('experiments')
          .update(experimentData)
          .eq('id', experimentId);
        if (error) throw error;
        alert('Experiment updated successfully!');
      } else {
        const { data, error } = await supabase
          .from('experiments')
          .insert([experimentData])
          .select()
          .single();
        if (error) throw error;
        setExperimentId(data.id);
        alert('Experiment saved successfully!');
      }
    } catch (error) {
      alert(`Error saving experiment: ${error.message}`);
    }
  };

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseIncucyteData(e.target.result);
        setRawData(result.rawData);
        setWells(result.wells);
        setTimepoints(result.timepoints);
        setConditions([
          { id: 1, name: 'Control', color: CONDITION_COLORS[0], wells: [] },
          { id: 2, name: 'Treatment', color: CONDITION_COLORS[1], wells: [] }
        ]);
        setExcludedWells(new Set());
        setControlConditionIdx(0);
        const maxTime = Math.max(...result.timepoints);
        setSelectedTimepoint(maxTime <= 24 ? maxTime : 24);
        setStep(2);
      } catch (error) {
        alert('Error parsing file: ' + error.message);
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
      assignWellsToCondition(selectedWells, activeConditionIdx);
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, getWellsInRect, assignWellsToCondition, activeConditionIdx]);

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

  const getWellStats = useCallback((well) => {
    if (!rawData?.[well]) return null;
    const values = rawData[well].filter(v => v != null);
    return { finalValue: values[values.length - 1] || 0, maxValue: Math.max(...values), values };
  }, [rawData]);

  const processData = useCallback(() => {
    if (!rawData || conditions.length === 0) return;
    
    const results = { 
      timeCourse: [], conditions: [...conditions], statistics: {},
      pValues: {}, auc: {},
      controlName: conditions[controlConditionIdx]?.name || conditions[0]?.name
    };

    const selectedIdx = timepoints.findIndex(t => t === selectedTimepoint);

    const conditionWellsMap = {};
    conditions.forEach(condition => {
      const activeWells = condition.wells.filter(well => !excludedWells.has(well));
      if (outlierMethod === 'bestTriplicate' && activeWells.length > 3 && selectedIdx >= 0) {
        conditionWellsMap[condition.name] = selectBestTriplicate(activeWells, rawData, selectedIdx);
      } else {
        conditionWellsMap[condition.name] = activeWells;
      }
    });
    
    timepoints.forEach((time, timeIdx) => {
      const timeData = { time };
      conditions.forEach(condition => {
        const wellsToUse = outlierMethod === 'bestTriplicate' ? conditionWellsMap[condition.name] : condition.wells.filter(well => !excludedWells.has(well));
        let values = wellsToUse
          .map(well => rawData[well]?.[timeIdx])
          .filter(v => v !== null && v !== undefined && !isNaN(v));
        if (outlierMethod === 'minmax' && values.length > 2) values = removeMinMax(values);
        const stats = calculateStats(values);
        timeData[`${condition.name}_mean`] = stats.mean;
        timeData[`${condition.name}_sd`] = stats.sd;
        timeData[`${condition.name}_sem`] = stats.sem;
        timeData[`${condition.name}_n`] = stats.n;
      });
      results.timeCourse.push(timeData);
    });
    
    const controlCondition = conditions[controlConditionIdx];
    
    if (selectedIdx >= 0) {
      const controlWells = outlierMethod === 'bestTriplicate' ? conditionWellsMap[controlCondition?.name] : controlCondition?.wells.filter(well => !excludedWells.has(well));
      let controlValues = (controlWells || [])
        .map(well => rawData[well]?.[selectedIdx])
        .filter(v => v !== null && v !== undefined && !isNaN(v));
      if (outlierMethod === 'minmax' && controlValues.length > 2) controlValues = removeMinMax(controlValues);
      
      conditions.forEach(condition => {
        const wellsToUse = outlierMethod === 'bestTriplicate' ? conditionWellsMap[condition.name] : condition.wells.filter(well => !excludedWells.has(well));
        let values = wellsToUse
          .map(well => rawData[well]?.[selectedIdx])
          .filter(v => v !== null && v !== undefined && !isNaN(v));
        if (outlierMethod === 'minmax' && values.length > 2) values = removeMinMax(values);
        results.statistics[condition.name] = calculateStats(values);
        results.pValues[condition.name] = condition.name !== controlCondition?.name 
          ? tTest(controlValues, values) 
          : { p: 1, stars: '-', significant: false };
      });

      results.representativeWells = {};
      conditions.forEach(condition => {
        const activeWells = condition.wells.filter(well => !excludedWells.has(well));
        const condMean = results.statistics[condition.name]?.mean;
        if (condMean === undefined || activeWells.length === 0) return;
        
        if (outlierMethod === 'bestTriplicate' && conditionWellsMap[condition.name]) {
          const bestWells = conditionWellsMap[condition.name];
          results.representativeWells[condition.name] = bestWells.map(well => ({
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
            results.representativeWells[condition.name] = wellDiffs.map(w => ({ well: w.well, value: w.value }));
          }
        }
      });
    }
    
    conditions.forEach(condition => {
      const meanValues = results.timeCourse.map(tc => tc[`${condition.name}_mean`] || 0);
      results.auc[condition.name] = calculateAUC(timepoints, meanValues);
    });
    
    const controlAUC = results.auc[controlCondition?.name] || 1;
    conditions.forEach(condition => {
      results.auc[`${condition.name}_relative`] = (results.auc[condition.name] / controlAUC * 100).toFixed(1);
    });
    
    setProcessedData(results);
    setStep(4);
  }, [rawData, conditions, timepoints, excludedWells, outlierMethod, selectedTimepoint, controlConditionIdx]);

  const barChartData = useMemo(() => {
    if (!processedData) return [];
    return conditions.map(condition => ({
      name: condition.name,
      value: processedData.statistics[condition.name]?.mean || 0,
      error: processedData.statistics[condition.name]?.[errorBarType] || 0,
      fill: condition.color,
      pValue: processedData.pValues[condition.name]?.p || 1,
      significance: processedData.pValues[condition.name]?.stars || 'ns',
      n: processedData.statistics[condition.name]?.n || 0
    }));
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
    } catch (error) {
      alert('Export failed. Please try again.');
    }
    setIsExporting(false);
  }, [theme]);

  const exportToCSV = useCallback(() => {
    if (!processedData) return;
    let csv = 'Time (h)';
    conditions.forEach(c => { csv += `,${c.name} Mean,${c.name} SD,${c.name} SEM,${c.name} N`; });
    csv += '\n';
    processedData.timeCourse.forEach(row => {
      csv += row.time;
      conditions.forEach(c => {
        csv += `,${row[`${c.name}_mean`]?.toFixed(4) || ''},${row[`${c.name}_sd`]?.toFixed(4) || ''},${row[`${c.name}_sem`]?.toFixed(4) || ''},${row[`${c.name}_n`] || ''}`;
      });
      csv += '\n';
    });
    csv += `\n\nEndpoint Statistics (t=${selectedTimepoint}h)\nCondition,Mean,SD,SEM,N,p-value,Significance,AUC,Relative AUC (%),Rep. Well 1,Rep. Value 1,Rep. Well 2,Rep. Value 2,Rep. Well 3,Rep. Value 3\n`;
    conditions.forEach(c => {
      const stats = processedData.statistics[c.name] || {};
      const pVal = processedData.pValues[c.name] || {};
      const repWells = processedData.representativeWells?.[c.name] || [];
      csv += `${c.name},${stats.mean?.toFixed(4) || ''},${stats.sd?.toFixed(4) || ''},${stats.sem?.toFixed(4) || ''},${stats.n || ''},${pVal.p?.toFixed(4) || ''},${pVal.stars || ''},${processedData.auc[c.name]?.toFixed(2) || ''},${processedData.auc[`${c.name}_relative`] || ''}`;
      for (let i = 0; i < 3; i++) {
        csv += `,${repWells[i]?.well || ''},${repWells[i]?.value?.toFixed(4) || ''}`;
      }
      csv += '\n';
    });
    csv += `\n\nRaw Well Data (Time Course)\n`;
    conditions.forEach(c => {
      const activeWells = c.wells.filter(w => !excludedWells.has(w));
      if (activeWells.length === 0) return;
      csv += `\n${c.name}\n`;
      csv += `Time (h),${activeWells.join(',')}\n`;
      timepoints.forEach((time, timeIdx) => {
        csv += time;
        activeWells.forEach(well => {
          const val = rawData[well]?.[timeIdx];
          csv += `,${val !== null && val !== undefined && !isNaN(val) ? val.toFixed(4) : ''}`;
        });
        csv += '\n';
      });
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName.replace(/\.[^/.]+$/, '')}_analyzed.csv`;
    link.click();
  }, [processedData, conditions, fileName, selectedTimepoint, rawData, timepoints, excludedWells]);

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
            errorBarType={errorBarType}
            setErrorBarType={setErrorBarType}
            selectedTimepoint={selectedTimepoint}
            setSelectedTimepoint={setSelectedTimepoint}
            timepoints={timepoints}
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
          excludedWells={excludedWells}
          rawData={rawData}
          controlConditionIdx={controlConditionIdx}
          figureTitle={figureTitle}
          xAxisLabel={xAxisLabel}
          yAxisLabel={yAxisLabel}
          chartTheme={chartTheme}
          setChartTheme={setChartTheme}
          setFigureTitle={setFigureTitle}
          setXAxisLabel={setXAxisLabel}
          setYAxisLabel={setYAxisLabel}
          timeCourseRef={timeCourseRef}
          barChartRef={barChartRef}
          isExporting={isExporting}
          setIsExporting={setIsExporting}
          showExportPanel={showExportPanel}
          setShowExportPanel={setShowExportPanel}
          onBack={() => setStep(3)}
          onSave={user ? saveExperiment : null}
        />
      )}
        
        <footer style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px solid rgba(51, 65, 85, 0.5)', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#64748b' }}>Incucyte Wound Healing Analyzer • Publication-Ready Edition</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
