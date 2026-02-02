import React, { useState, useCallback, useMemo, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ErrorBar, Cell } from 'recharts';
import html2canvas from 'html2canvas';

const CONDITION_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2',
  '#7c3aed', '#db2777', '#0d9488', '#d97706', '#4f46e5', '#059669'
];

const CHART_THEMES = {
  dark: {
    name: 'Dark (Presentation)',
    background: '#0f172a',
    cardBg: 'rgba(30, 41, 59, 0.95)',
    gridColor: '#334155',
    textColor: '#e2e8f0',
    axisColor: '#64748b',
    tickColor: '#94a3b8',
    tooltipBg: '#1e293b',
    tooltipBorder: '#334155'
  },
  white: {
    name: 'White (Publication)',
    background: '#ffffff',
    cardBg: '#ffffff',
    gridColor: '#e5e7eb',
    textColor: '#111827',
    axisColor: '#374151',
    tickColor: '#4b5563',
    tooltipBg: '#ffffff',
    tooltipBorder: '#d1d5db'
  },
  black: {
    name: 'Black (High Contrast)',
    background: '#000000',
    cardBg: '#000000',
    gridColor: '#374151',
    textColor: '#ffffff',
    axisColor: '#9ca3af',
    tickColor: '#d1d5db',
    tooltipBg: '#1f2937',
    tooltipBorder: '#4b5563'
  }
};

const calculateStats = (values) => {
  const filtered = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (filtered.length === 0) return { mean: 0, sd: 0, sem: 0, n: 0, values: [] };
  const n = filtered.length;
  const mean = filtered.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? filtered.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const sem = n > 0 ? sd / Math.sqrt(n) : 0;
  return { mean, sd, sem, n, values: filtered };
};

const tTest = (group1, group2) => {
  const stats1 = calculateStats(group1);
  const stats2 = calculateStats(group2);
  
  if (stats1.n < 2 || stats2.n < 2) return { t: 0, p: 1, significant: false };
  
  const n1 = stats1.n, n2 = stats2.n;
  const m1 = stats1.mean, m2 = stats2.mean;
  const v1 = stats1.sd * stats1.sd, v2 = stats2.sd * stats2.sd;
  
  const se = Math.sqrt(v1/n1 + v2/n2);
  if (se === 0) return { t: 0, p: 1, significant: false };
  
  const t = (m1 - m2) / se;
  const df = Math.pow(v1/n1 + v2/n2, 2) / (Math.pow(v1/n1, 2)/(n1-1) + Math.pow(v2/n2, 2)/(n2-1));
  const p = tDistributionP(Math.abs(t), df);
  
  return { 
    t, p, df,
    significant: p < 0.05,
    stars: p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns'
  };
};

const tDistributionP = (t, df) => {
  if (df >= 30) {
    const z = Math.abs(t);
    return 2 * (1 - normalCDF(z));
  }
  
  const criticalValues = {
    0.05: [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228],
    0.01: [63.657, 9.925, 5.841, 4.604, 4.032, 3.707, 3.499, 3.355, 3.250, 3.169],
    0.001: [636.619, 31.599, 12.924, 8.610, 6.869, 5.959, 5.408, 5.041, 4.781, 4.587]
  };
  
  const dfIndex = Math.min(Math.floor(df) - 1, 9);
  if (dfIndex < 0) return 1;
  
  const absT = Math.abs(t);
  if (absT >= criticalValues[0.001][dfIndex]) return 0.001;
  if (absT >= criticalValues[0.01][dfIndex]) return 0.01;
  if (absT >= criticalValues[0.05][dfIndex]) return 0.05;
  return 0.5;
};

const normalCDF = (x) => {
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
};

const calculateAUC = (timepoints, values) => {
  if (timepoints.length < 2 || values.length < 2) return 0;
  let auc = 0;
  for (let i = 1; i < timepoints.length; i++) {
    const dt = timepoints[i] - timepoints[i-1];
    const avgValue = (values[i] + values[i-1]) / 2;
    auc += dt * avgValue;
  }
  return auc;
};

const removeMinMax = (values) => {
  const filtered = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (filtered.length <= 2) return filtered;
  const sorted = [...filtered].sort((a, b) => a - b);
  return sorted.slice(1, -1);
};

const selectBestTriplicate = (wells, rawData, timeIdx) => {
  if (wells.length <= 3) return wells;
  const validWells = wells.filter(w => {
    const v = rawData[w]?.[timeIdx];
    return v !== null && v !== undefined && !isNaN(v);
  });
  if (validWells.length <= 3) return validWells;

  let bestCombo = validWells.slice(0, 3);
  let bestVariance = Infinity;

  for (let i = 0; i < validWells.length - 2; i++) {
    for (let j = i + 1; j < validWells.length - 1; j++) {
      for (let k = j + 1; k < validWells.length; k++) {
        const vals = [
          rawData[validWells[i]][timeIdx],
          rawData[validWells[j]][timeIdx],
          rawData[validWells[k]][timeIdx]
        ];
        const mean = (vals[0] + vals[1] + vals[2]) / 3;
        const variance = (Math.pow(vals[0] - mean, 2) + Math.pow(vals[1] - mean, 2) + Math.pow(vals[2] - mean, 2)) / 2;
        if (variance < bestVariance) {
          bestVariance = variance;
          bestCombo = [validWells[i], validWells[j], validWells[k]];
        }
      }
    }
  }
  return bestCombo;
};

const parseIncucyteData = (text) => {
  const lines = text.split('\n').filter(line => line.trim());
  let headerIndex = -1;
  let headers = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Elapsed') || lines[i].match(/[A-H]\d+/)) {
      headerIndex = i;
      headers = lines[i].split('\t').map(h => h.trim());
      break;
    }
  }
  
  if (headerIndex === -1) throw new Error('Could not find header row');
  
  const wellPattern = /([A-H])(\d+)/;
  const wells = [];
  const wellIndices = {};
  
  headers.forEach((header, idx) => {
    const match = header.match(wellPattern);
    if (match) {
      const wellName = `${match[1]}${match[2]}`;
      if (!wells.includes(wellName)) {
        wells.push(wellName);
        wellIndices[wellName] = idx;
      }
    }
  });
  
  const timepoints = [];
  const rawData = {};
  wells.forEach(well => { rawData[well] = []; });
  
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    if (values.length < 3) continue;
    const elapsed = parseFloat(values[1]);
    if (isNaN(elapsed)) continue;
    timepoints.push(elapsed);
    wells.forEach(well => {
      const idx = wellIndices[well];
      const value = parseFloat(values[idx]);
      rawData[well].push(isNaN(value) ? null : value);
    });
  }
  
  return { wells, timepoints, rawData };
};

const CustomTooltip = ({ active, payload, label, theme }) => {
  if (!active || !payload) return null;
  const t = CHART_THEMES[theme] || CHART_THEMES.dark;
  return (
    <div style={{
      backgroundColor: t.tooltipBg,
      border: `1px solid ${t.tooltipBorder}`,
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    }}>
      <p style={{ color: t.textColor, fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>{label}h</p>
      {payload.map((entry, idx) => (
        <p key={idx} style={{ color: entry.color, fontSize: '13px', margin: '4px 0' }}>
          {entry.name}: {entry.value?.toFixed(2)}%
        </p>
      ))}
    </div>
  );
};

const WellCell = ({ well, hasData, condition, isExcluded, onClick, onMouseDown, onMouseEnter, onMouseUp, isDragSelected, activeColor }) => {
  const baseStyle = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: '500',
    cursor: hasData ? 'pointer' : 'not-allowed',
    transition: 'background-color 0.1s, border-color 0.1s',
    opacity: !hasData ? 0.3 : isExcluded ? 0.4 : 1,
    textDecoration: isExcluded ? 'line-through' : 'none',
    backgroundColor: !hasData ? '#1e293b' : isDragSelected ? `${activeColor}44` : condition ? `${condition.color}22` : '#334155',
    borderColor: !hasData ? '#334155' : isDragSelected ? activeColor : condition ? condition.color : '#475569',
    color: !hasData ? '#64748b' : isDragSelected ? activeColor : condition ? condition.color : '#94a3b8',
    boxShadow: isDragSelected ? `0 0 8px ${activeColor}66` : 'none',
    transform: isDragSelected ? 'scale(1.05)' : 'scale(1)'
  };

  return (
    <button 
      disabled={!hasData} 
      onClick={onClick} 
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseUp={onMouseUp}
      style={baseStyle}
      title={hasData ? `${well}${condition ? ` - ${condition.name}` : ''}${isExcluded ? ' (Excluded)' : ''}` : 'No data'}>
      {hasData && well.slice(1)}
    </button>
  );
};

const Sparkline = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 100}`).join(' ');
  
  return (
    <svg style={{ width: '100%', height: '32px' }} viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="3" points={points} />
    </svg>
  );
};

const ExportPanel = ({ onExportPNG, onExportCSV, isExporting, chartTheme, setChartTheme }) => {
  return (
    <div style={{
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #334155'
    }}>
      <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: '#e2e8f0' }}>
        📤 Export Center
      </h4>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
          Chart Background Theme
        </label>
        <div style={{ display: 'flex', gap: '6px' }}>
          {Object.entries(CHART_THEMES).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => setChartTheme(key)}
              style={{
                flex: 1,
                padding: '8px 4px',
                borderRadius: '6px',
                border: chartTheme === key ? '2px solid #0891b2' : '2px solid transparent',
                backgroundColor: theme.background,
                color: theme.textColor,
                fontSize: '10px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {key === 'dark' ? '🌙' : key === 'white' ? '☀️' : '⬛'} {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button onClick={onExportPNG} disabled={isExporting}
          style={{
            padding: '12px 16px', borderRadius: '8px', border: 'none',
            backgroundColor: '#0891b2', color: 'white', fontWeight: '500',
            cursor: isExporting ? 'wait' : 'pointer', opacity: isExporting ? 0.7 : 1
          }}>
          📷 Export PNG (300 DPI)
        </button>
        <button onClick={onExportCSV}
          style={{
            padding: '12px 16px', borderRadius: '8px', border: 'none',
            backgroundColor: '#059669', color: 'white', fontWeight: '500', cursor: 'pointer'
          }}>
          📊 Export CSV + Statistics
        </button>
      </div>
      <p style={{ fontSize: '10px', color: '#64748b', marginTop: '12px', lineHeight: '1.4' }}>
        💡 Tip: Use <strong>White</strong> theme for journal submissions, <strong>Dark</strong> for presentations
      </p>
    </div>
  );
};

function App() {
  const [step, setStep] = useState(1);
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

    // Pre-compute filtered wells for bestTriplicate (selected once, used everywhere)
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
          // Show the best triplicate wells directly
          const bestWells = conditionWellsMap[condition.name];
          results.representativeWells[condition.name] = bestWells.map(well => ({
            well, value: rawData[well]?.[selectedIdx]
          }));
        } else {
          // Find top 3 wells closest to the mean
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0' }}>
            <div onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', maxWidth: '500px', padding: '48px', border: '2px dashed #475569', borderRadius: '16px', backgroundColor: 'rgba(30, 41, 59, 0.3)', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>Upload Incucyte Data File</p>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>Supports .txt and .csv exports</p>
              <span style={{ ...styles.button, ...styles.primaryButton, display: 'inline-block' }}>Select File</span>
            </div>
            <input ref={fileInputRef} type="file" accept=".txt,.csv,.tsv" onChange={handleFileUpload} style={{ display: 'none' }} />
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Conditions</h2>
                <button onClick={addCondition} style={{ ...styles.button, ...styles.primaryButton, padding: '6px 12px', fontSize: '13px' }}>+ Add</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {conditions.map((condition, idx) => (
                  <div 
                    key={condition.id} 
                    onClick={() => setActiveConditionIdx(idx)}
                    draggable
                    onDragStart={(e) => {
                      setDraggedConditionIdx(idx);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (draggedConditionIdx !== idx) {
                        setDragOverConditionIdx(idx);
                      }
                    }}
                    onDragLeave={() => {
                      setDragOverConditionIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedConditionIdx !== null && draggedConditionIdx !== idx) {
                        reorderConditions(draggedConditionIdx, idx);
                      }
                      setDraggedConditionIdx(null);
                      setDragOverConditionIdx(null);
                    }}
                    onDragEnd={() => {
                      setDraggedConditionIdx(null);
                      setDragOverConditionIdx(null);
                    }}
                    style={{ 
                      padding: '12px', 
                      borderRadius: '12px', 
                      backgroundColor: activeConditionIdx === idx ? '#334155' : 'rgba(51, 65, 85, 0.5)', 
                      cursor: 'grab',
                      border: dragOverConditionIdx === idx 
                        ? '2px solid #22d3ee' 
                        : activeConditionIdx === idx 
                          ? '2px solid rgba(8, 145, 178, 0.5)' 
                          : '2px solid transparent',
                      opacity: draggedConditionIdx === idx ? 0.5 : 1,
                      transform: dragOverConditionIdx === idx ? 'scale(1.02)' : 'scale(1)',
                      transition: 'transform 0.15s, border-color 0.15s'
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div 
                        style={{ cursor: 'grab', padding: '2px', color: '#64748b', display: 'flex', alignItems: 'center' }}
                        title="Drag to reorder"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/>
                          <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
                          <circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
                        </svg>
                      </div>
                      <input type="color" value={condition.color} onChange={(e) => updateCondition(idx, { color: e.target.value })} onClick={(e) => e.stopPropagation()}
                        style={{ width: '24px', height: '24px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                      <input type="text" value={condition.name} onChange={(e) => updateCondition(idx, { name: e.target.value })} onClick={(e) => e.stopPropagation()}
                        style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: '#f1f5f9', fontSize: '14px', fontWeight: '500', outline: 'none' }} />
                      {conditions.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); removeCondition(idx); }}
                          style={{ padding: '4px', backgroundColor: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{condition.wells.length} wells</span>
                      {idx === controlConditionIdx && (
                        <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', borderRadius: '4px' }}>Control</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
                Drag conditions to reorder
              </p>
              
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Reference Control</label>
                <select value={controlConditionIdx} onChange={(e) => setControlConditionIdx(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', backgroundColor: '#334155', border: '1px solid #475569', color: '#f1f5f9', fontSize: '13px' }}>
                  {conditions.map((c, idx) => <option key={c.id} value={idx}>{c.name}</option>)}
                </select>
              </div>
              
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Quick Assign: <span style={{ color: '#22d3ee' }}>{conditions[activeConditionIdx]?.name}</span></p>
                <p style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>Rows (horizontal)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  {['B', 'C', 'D', 'E', 'F', 'G'].map(row => (
                    <button key={row} onClick={() => assignRowToCondition(row, activeConditionIdx, 2, 7)}
                      style={{ padding: '6px', fontSize: '11px', backgroundColor: '#334155', border: 'none', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer' }}>
                      {row}2-{row}7
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px', marginBottom: '6px' }}>Columns (vertical)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                  {[2, 3, 4, 5, 6, 7].map(col => (
                    <button key={col} onClick={() => assignColumnToCondition(col, activeConditionIdx, 'B', 'G')}
                      style={{ padding: '6px', fontSize: '11px', backgroundColor: '#334155', border: 'none', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer' }}>
                      B{col}-G{col}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div style={styles.card}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>96-Well Plate Map</h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px 0' }}>
                {isDragging ? (
                  <span style={{ color: '#22d3ee' }}>Drag to select wells... ({dragSelectedWells.size} selected)</span>
                ) : (
                  <>Click or drag to select wells for <span style={{ color: '#22d3ee' }}>{conditions[activeConditionIdx]?.name}</span></>
                )}
              </p>
              
              <div 
                style={{ overflowX: 'auto', userSelect: isDragging ? 'none' : 'auto' }}
                onMouseLeave={() => isDragging && handleDragEnd()}
                onMouseUp={handleDragEnd}
              >
                <div style={{ display: 'inline-block' }}>
                  <div style={{ display: 'flex', gap: '4px', marginLeft: '24px', marginBottom: '4px' }}>
                    {plateGrid.cols.map(col => (
                      <div key={col} style={{ width: '36px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#94a3b8' }}>{col}</div>
                    ))}
                  </div>
                  {plateGrid.rows.map(row => (
                    <div key={row} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      <div style={{ width: '20px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#94a3b8' }}>{row}</div>
                      {plateGrid.cols.map(col => {
                        const wellName = `${row}${col}`;
                        const hasWellData = wells.includes(wellName);
                        return (
                          <WellCell 
                            key={wellName} 
                            well={wellName} 
                            hasData={hasWellData} 
                            condition={getWellCondition(wellName)} 
                            isExcluded={excludedWells.has(wellName)}
                            isDragSelected={dragSelectedWells.has(wellName)}
                            activeColor={conditions[activeConditionIdx]?.color || '#22d3ee'}
                            onClick={() => !isDragging && hasWellData && assignWellToCondition(wellName, activeConditionIdx)}
                            onMouseDown={(e) => {
                              if (hasWellData) {
                                e.preventDefault();
                                handleDragStart(wellName);
                              }
                            }}
                            onMouseEnter={() => hasWellData && handleDragEnter(wellName)}
                            onMouseUp={handleDragEnd}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {conditions.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: c.color }} />{c.name} ({c.wells.length})
                  </div>
                ))}
              </div>
              
              <button onClick={() => setStep(3)} disabled={conditions.every(c => c.wells.length === 0)}
                style={{ width: '100%', marginTop: '16px', ...styles.button, ...styles.primaryButton, opacity: conditions.every(c => c.wells.length === 0) ? 0.5 : 1 }}>
                Continue to Review →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <div style={styles.card}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>Review Well Data</h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>Click wells to exclude/include</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {conditions.map(condition => (
                  <div key={condition.id}>
                    <h3 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: condition.color }} />{condition.name}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
                      {condition.wells.map(well => {
                        const isExcluded = excludedWells.has(well);
                        const stats = getWellStats(well);
                        return (
                          <div key={well} onClick={() => toggleExcludedWell(well)}
                            style={{ padding: '12px', borderRadius: '12px', border: '1px solid #475569',
                              backgroundColor: isExcluded ? 'rgba(30, 41, 59, 0.3)' : 'rgba(51, 65, 85, 0.5)', opacity: isExcluded ? 0.5 : 1, cursor: 'pointer' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '500', color: isExcluded ? '#94a3b8' : condition.color }}>{well}</span>
                              {isExcluded && <span style={{ fontSize: '9px', padding: '2px 4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '4px' }}>×</span>}
                            </div>
                            {stats && (<><Sparkline data={stats.values} color={isExcluded ? '#475569' : condition.color} />
                              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>Final: {stats.finalValue.toFixed(1)}%</div></>)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ ...styles.card, height: 'fit-content', position: 'sticky', top: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Analysis Settings</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Figure Title</label>
                  <input type="text" value={figureTitle} onChange={(e) => setFigureTitle(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#334155', border: '1px solid #475569', color: '#f1f5f9', fontSize: '14px' }} />
                </div>
                
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Outlier Removal</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[{ key: 'none', label: 'None' }, { key: 'minmax', label: 'Min/Max' }, { key: 'bestTriplicate', label: 'Best Triplicate' }].map(opt => (
                      <button key={opt.key} onClick={() => setOutlierMethod(opt.key)}
                        style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                          backgroundColor: outlierMethod === opt.key ? '#0891b2' : '#334155',
                          color: outlierMethod === opt.key ? 'white' : '#e2e8f0', fontWeight: '500', cursor: 'pointer', fontSize: '12px' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                    {outlierMethod === 'minmax' ? 'Removes highest & lowest values per timepoint' : outlierMethod === 'bestTriplicate' ? 'Selects 3 wells with smallest variance' : 'No outlier filtering applied'}
                  </p>
                </div>
                
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Error Bars</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['sem', 'sd'].map(type => (
                      <button key={type} onClick={() => setErrorBarType(type)}
                        style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                          backgroundColor: errorBarType === type ? '#0891b2' : '#334155',
                          color: errorBarType === type ? 'white' : '#e2e8f0', fontWeight: '500', cursor: 'pointer' }}>
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Endpoint Timepoint</label>
                  <select value={selectedTimepoint} onChange={(e) => setSelectedTimepoint(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#334155', border: '1px solid #475569', color: '#f1f5f9', fontSize: '14px' }}>
                    {timepoints.map(t => <option key={t} value={t}>{t}h</option>)}
                  </select>
                </div>
                
                <div style={{ padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.5)', borderRadius: '12px', fontSize: '12px', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Conditions:</span><span style={{ color: '#e2e8f0' }}>{conditions.length}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Timepoints:</span><span style={{ color: '#e2e8f0' }}>{timepoints.length}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Total wells:</span><span style={{ color: '#e2e8f0' }}>{conditions.reduce((sum, c) => sum + c.wells.length, 0)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Control:</span><span style={{ color: '#4ade80' }}>{conditions[controlConditionIdx]?.name}</span></div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, ...styles.button, ...styles.secondaryButton }}>← Back</button>
                <button onClick={processData} style={{ flex: 1, ...styles.button, ...styles.primaryButton }}>Analyze →</button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && processedData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{figureTitle}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setStep(3)} style={{ ...styles.button, ...styles.secondaryButton }}>← Edit</button>
                <button onClick={() => setShowExportPanel(!showExportPanel)} 
                  style={{ ...styles.button, backgroundColor: showExportPanel ? '#7c3aed' : '#0891b2', color: 'white' }}>
                  📤 Export Options
                </button>
              </div>
            </div>
            
            {showExportPanel && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <ExportPanel
                  onExportPNG={() => exportToPNG(timeCourseRef, `${fileName.replace(/\.[^/.]+$/, '')}_timecourse`)}
                  onExportCSV={exportToCSV}
                  isExporting={isExporting}
                  chartTheme={chartTheme}
                  setChartTheme={setChartTheme}
                />
                <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.95)', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: '#e2e8f0' }}>📊 Bar Chart Export</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button onClick={() => exportToPNG(barChartRef, `${fileName.replace(/\.[^/.]+$/, '')}_endpoint`)} disabled={isExporting}
                      style={{ padding: '12px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0891b2', color: 'white', fontWeight: '500', cursor: isExporting ? 'wait' : 'pointer' }}>
                      📷 Export Bar Chart PNG
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div style={styles.chartCard} ref={timeCourseRef}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: theme.textColor }}>
                  Wound Healing Time Course
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', color: theme.tickColor }}>Show until:</label>
                  <select 
                    value={timeCourseEndpoint === null ? '' : timeCourseEndpoint}
                    onChange={(e) => setTimeCourseEndpoint(e.target.value === '' ? null : Number(e.target.value))}
                    style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: theme.background === '#ffffff' ? '#f3f4f6' : '#334155', border: `1px solid ${theme.gridColor}`, color: theme.textColor, fontSize: '12px' }}
                  >
                    <option value="">All ({Math.max(...timepoints)}h)</option>
                    {timepoints.filter(t => t > 0).map(t => (
                      <option key={t} value={t}>{t}h</option>
                    ))}
                  </select>
                </div>
              </div>
              <p style={{ fontSize: '11px', color: theme.tickColor, marginBottom: '16px' }}>
                Data shown as mean ± {errorBarType.toUpperCase()} (n={processedData.statistics[conditions[0]?.name]?.n || 0})
              </p>
              <div style={{ height: '420px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredTimeCourse} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} />
                    <XAxis 
                      dataKey="time" 
                      stroke={theme.axisColor}
                      tick={{ fill: theme.tickColor, fontSize: 12, fontFamily: 'Arial, sans-serif' }}
                      tickLine={{ stroke: theme.axisColor }}
                      axisLine={{ stroke: theme.axisColor }}
                    />
                    <YAxis 
                      stroke={theme.axisColor}
                      tick={{ fill: theme.tickColor, fontSize: 12, fontFamily: 'Arial, sans-serif' }}
                      tickLine={{ stroke: theme.axisColor }}
                      axisLine={{ stroke: theme.axisColor }}
                      domain={[0, 'auto']}
                      label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: theme.textColor, fontSize: 13, fontFamily: 'Arial, sans-serif', dx: -5 }}
                    />
                    <Tooltip content={<CustomTooltip theme={chartTheme} />} />
                    <Legend 
                      verticalAlign="bottom"
                      height={36}
                      wrapperStyle={{ paddingTop: '20px', fontFamily: 'Arial, sans-serif' }}
                      formatter={(value) => <span style={{ color: theme.textColor, fontSize: '12px' }}>{value}</span>}
                    />
                    {conditions.map(condition => (
                      <Line key={condition.id} type="monotone" dataKey={`${condition.name}_mean`} name={condition.name}
                        stroke={condition.color} strokeWidth={2.5} dot={{ fill: condition.color, r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '13px', color: theme.textColor, fontFamily: 'Arial, sans-serif' }}>{xAxisLabel}</span>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={styles.chartCard} ref={barChartRef}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px', color: theme.textColor }}>
                  Endpoint Comparison ({selectedTimepoint}h)
                </h3>
                <p style={{ fontSize: '11px', color: theme.tickColor, marginBottom: '16px' }}>
                  * p&lt;0.05, ** p&lt;0.01, *** p&lt;0.001 vs {processedData.controlName}
                </p>
                <div style={{ height: '380px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 40, right: 20, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke={theme.axisColor}
                        tick={{ fill: theme.tickColor, fontSize: 11, fontFamily: 'Arial, sans-serif' }}
                        tickLine={{ stroke: theme.axisColor }}
                        axisLine={{ stroke: theme.axisColor }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={0}
                      />
                      <YAxis 
                        stroke={theme.axisColor}
                        tick={{ fill: theme.tickColor, fontSize: 12, fontFamily: 'Arial, sans-serif' }}
                        tickLine={{ stroke: theme.axisColor }}
                        axisLine={{ stroke: theme.axisColor }}
                        label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: theme.textColor, fontSize: 12, fontFamily: 'Arial, sans-serif' }}
                      />
                      <Tooltip contentStyle={{ backgroundColor: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, borderRadius: '8px', color: theme.textColor }}
                        formatter={(value, name, props) => [`${value?.toFixed(2)}% ± ${props.payload.error?.toFixed(2)} (n=${props.payload.n})`, 'Mean']} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}
                        label={({ x, y, width, index }) => {
                          const sig = barChartData[index]?.significance;
                          if (!sig || sig === 'ns' || sig === '-') return null;
                          return <text x={x + width/2} y={y - 10} textAnchor="middle" fill={chartTheme === 'white' ? '#b45309' : '#fbbf24'} fontSize="16" fontWeight="bold" fontFamily="Arial, sans-serif">{sig}</text>;
                        }}>
                        {barChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        <ErrorBar dataKey="error" width={6} strokeWidth={2} stroke={chartTheme === 'white' ? '#374151' : '#e2e8f0'} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div style={styles.card}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Statistical Analysis</h3>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Condition</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Mean ± {errorBarType.toUpperCase()}</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>N</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>p-value</th>
                      <th style={{ textAlign: 'center', padding: '8px' }}>Sig.</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Rep. Wells (Top 3)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conditions.map(condition => {
                      const stats = processedData.statistics[condition.name] || {};
                      const pVal = processedData.pValues[condition.name] || {};
                      const isControl = condition.name === processedData.controlName;
                      return (
                        <tr key={condition.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: condition.color }} />
                              {condition.name}{isControl && <span style={{ fontSize: '9px', color: '#4ade80' }}>(ref)</span>}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>{stats.mean?.toFixed(2)} ± {stats[errorBarType]?.toFixed(2)}%</td>
                          <td style={{ textAlign: 'right', padding: '8px', color: '#94a3b8' }}>{stats.n}</td>
                          <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>{isControl ? '-' : pVal.p?.toFixed(4)}</td>
                          <td style={{ textAlign: 'center', padding: '8px', color: '#fbbf24', fontWeight: 'bold' }}>{pVal.stars || '-'}</td>
                          <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>
                            {processedData.representativeWells?.[condition.name]?.length > 0
                              ? processedData.representativeWells[condition.name].map((rw, i) => (
                                  <span key={rw.well}>{i > 0 && ', '}{rw.well} ({rw.value?.toFixed(1)}%)</span>
                                ))
                              : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.3)', borderRadius: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>📈 AUC Analysis</h4>
                  <table style={{ width: '100%', fontSize: '12px' }}>
                    <thead><tr style={{ color: '#94a3b8' }}><th style={{ textAlign: 'left', padding: '4px' }}>Condition</th><th style={{ textAlign: 'right', padding: '4px' }}>AUC</th><th style={{ textAlign: 'right', padding: '4px' }}>vs Control</th></tr></thead>
                    <tbody>
                      {conditions.map(condition => (
                        <tr key={condition.id}>
                          <td style={{ padding: '4px', color: condition.color }}>{condition.name}</td>
                          <td style={{ textAlign: 'right', padding: '4px', fontFamily: 'monospace' }}>{processedData.auc[condition.name]?.toFixed(1)}</td>
                          <td style={{ textAlign: 'right', padding: '4px', fontFamily: 'monospace', color: '#4ade80' }}>{processedData.auc[`${condition.name}_relative`]}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.3)', borderRadius: '12px', fontSize: '11px', color: '#64748b' }}>
                  <div>• Endpoint: {selectedTimepoint}h • Error: {errorBarType.toUpperCase()}</div>
                  <div>• Outlier removal: {outlierMethod === 'none' ? 'None' : outlierMethod === 'minmax' ? 'Min/Max' : 'Best Triplicate'} • Test: Welch's t-test</div>
                </div>
              </div>
            </div>
            
            <div style={styles.card}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Complete Time Course Data</h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e293b' }}>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Time</th>
                      {conditions.map(c => <th key={c.id} style={{ textAlign: 'right', padding: '8px', color: c.color }}>{c.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {processedData.timeCourse.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>{row.time}h</td>
                        {conditions.map(c => (
                          <td key={c.id} style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
                            {row[`${c.name}_mean`]?.toFixed(2)} <span style={{ color: '#64748b' }}>± {row[`${c.name}_${errorBarType}`]?.toFixed(2)}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        <footer style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px solid rgba(51, 65, 85, 0.5)', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#64748b' }}>Incucyte Wound Healing Analyzer • Publication-Ready Edition</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
