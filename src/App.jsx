import React, { useState, useCallback, useMemo, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ErrorBar, Cell } from 'recharts';

// Scientific color palette
const CONDITION_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1', '#10b981'
];

// Statistical utilities
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

const removeMinMax = (values) => {
  const filtered = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (filtered.length <= 2) return filtered;
  const sorted = [...filtered].sort((a, b) => a - b);
  return sorted.slice(1, -1);
};

// Parse Incucyte data
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

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div style={{
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
    }}>
      <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px' }}>{label}h</p>
      {payload.map((entry, idx) => (
        <p key={idx} style={{ color: entry.color, fontSize: '13px', margin: '2px 0' }}>
          {entry.name}: {entry.value?.toFixed(2)}%
        </p>
      ))}
    </div>
  );
};

// Well Cell Component
const WellCell = ({ well, hasData, condition, isExcluded, onClick }) => {
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
    transition: 'all 0.2s',
    opacity: !hasData ? 0.3 : isExcluded ? 0.4 : 1,
    textDecoration: isExcluded ? 'line-through' : 'none',
    backgroundColor: !hasData ? '#1e293b' : condition ? `${condition.color}33` : '#334155',
    borderColor: !hasData ? '#334155' : condition ? condition.color : '#475569',
    color: !hasData ? '#64748b' : condition ? condition.color : '#94a3b8'
  };

  return (
    <button
      disabled={!hasData}
      onClick={onClick}
      style={baseStyle}
      title={hasData ? `${well}${condition ? ` - ${condition.name}` : ''}${isExcluded ? ' (Excluded)' : ''}` : 'No data'}
    >
      {hasData && well.slice(1)}
    </button>
  );
};

// Mini sparkline for well preview
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

// Main App
function App() {
  const [step, setStep] = useState(1);
  const [rawData, setRawData] = useState(null);
  const [wells, setWells] = useState([]);
  const [timepoints, setTimepoints] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [excludedWells, setExcludedWells] = useState(new Set());
  const [autoRemoveMinMax, setAutoRemoveMinMax] = useState(true);
  const [errorBarType, setErrorBarType] = useState('sem');
  const [selectedTimepoint, setSelectedTimepoint] = useState(24);
  const [processedData, setProcessedData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [activeConditionIdx, setActiveConditionIdx] = useState(0);
  const fileInputRef = useRef(null);

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
          { id: 1, name: 'Negative Control', color: CONDITION_COLORS[0], wells: [] },
          { id: 2, name: 'Positive Control', color: CONDITION_COLORS[1], wells: [] }
        ]);
        setExcludedWells(new Set());
        
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
    const newConditions = [...conditions, {
      id: newId,
      name: `Treatment ${newId}`,
      color: CONDITION_COLORS[conditions.length % CONDITION_COLORS.length],
      wells: []
    }];
    setConditions(newConditions);
    setActiveConditionIdx(newConditions.length - 1);
  }, [conditions]);

  const removeCondition = useCallback((index) => {
    if (conditions.length <= 1) return;
    setConditions(conditions.filter((_, i) => i !== index));
    setActiveConditionIdx(Math.max(0, activeConditionIdx - 1));
  }, [conditions, activeConditionIdx]);

  const updateCondition = useCallback((index, updates) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  }, [conditions]);

  const assignWellToCondition = useCallback((well, conditionIndex) => {
    const newConditions = conditions.map((c, i) => ({
      ...c,
      wells: i === conditionIndex 
        ? (c.wells.includes(well) ? c.wells.filter(w => w !== well) : [...c.wells, well])
        : c.wells.filter(w => w !== well)
    }));
    setConditions(newConditions);
  }, [conditions]);

  const assignRowToCondition = useCallback((row, conditionIndex, colStart, colEnd) => {
    const newConditions = conditions.map((c, i) => {
      const rowWells = Array.from({length: colEnd - colStart + 1}, (_, idx) => `${row}${colStart + idx}`)
        .filter(w => wells.includes(w));
      
      if (i === conditionIndex) {
        return { ...c, wells: [...new Set([...c.wells, ...rowWells])] };
      } else {
        return { ...c, wells: c.wells.filter(w => !rowWells.includes(w)) };
      }
    });
    setConditions(newConditions);
  }, [conditions, wells]);

  const getWellCondition = useCallback((well) => {
    for (let i = 0; i < conditions.length; i++) {
      if (conditions[i].wells.includes(well)) {
        return { index: i, ...conditions[i] };
      }
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
    const finalValue = values[values.length - 1] || 0;
    const maxValue = Math.max(...values);
    return { finalValue, maxValue, values };
  }, [rawData]);

  const processData = useCallback(() => {
    if (!rawData || conditions.length === 0) return;
    
    const results = { timeCourse: [], conditions: [...conditions], statistics: {} };
    
    timepoints.forEach((time, timeIdx) => {
      const timeData = { time };
      
      conditions.forEach(condition => {
        let values = condition.wells
          .filter(well => !excludedWells.has(well))
          .map(well => rawData[well]?.[timeIdx])
          .filter(v => v !== null && v !== undefined && !isNaN(v));
        
        if (autoRemoveMinMax && values.length > 2) {
          values = removeMinMax(values);
        }
        
        const stats = calculateStats(values);
        timeData[`${condition.name}_mean`] = stats.mean;
        timeData[`${condition.name}_sd`] = stats.sd;
        timeData[`${condition.name}_sem`] = stats.sem;
        timeData[`${condition.name}_n`] = stats.n;
      });
      
      results.timeCourse.push(timeData);
    });
    
    const selectedIdx = timepoints.findIndex(t => t === selectedTimepoint);
    if (selectedIdx >= 0) {
      conditions.forEach(condition => {
        let values = condition.wells
          .filter(well => !excludedWells.has(well))
          .map(well => rawData[well]?.[selectedIdx])
          .filter(v => v !== null && v !== undefined && !isNaN(v));
        
        if (autoRemoveMinMax && values.length > 2) {
          values = removeMinMax(values);
        }
        
        results.statistics[condition.name] = calculateStats(values);
      });
    }
    
    setProcessedData(results);
    setStep(4);
  }, [rawData, conditions, timepoints, excludedWells, autoRemoveMinMax, selectedTimepoint]);

  const barChartData = useMemo(() => {
    if (!processedData) return [];
    return conditions.map(condition => ({
      name: condition.name,
      value: processedData.statistics[condition.name]?.mean || 0,
      error: processedData.statistics[condition.name]?.[errorBarType] || 0,
      fill: condition.color
    }));
  }, [processedData, conditions, errorBarType]);

  const exportToCSV = useCallback(() => {
    if (!processedData) return;
    
    let csv = 'Time (h)';
    conditions.forEach(c => {
      csv += `,${c.name} Mean,${c.name} SD,${c.name} SEM,${c.name} N`;
    });
    csv += '\n';
    
    processedData.timeCourse.forEach(row => {
      csv += row.time;
      conditions.forEach(c => {
        csv += `,${row[`${c.name}_mean`]?.toFixed(4) || ''}`;
        csv += `,${row[`${c.name}_sd`]?.toFixed(4) || ''}`;
        csv += `,${row[`${c.name}_sem`]?.toFixed(4) || ''}`;
        csv += `,${row[`${c.name}_n`] || ''}`;
      });
      csv += '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.[^/.]+$/, '')}_analyzed.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [processedData, conditions, fileName]);

  const plateGrid = useMemo(() => ({
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    cols: Array.from({ length: 12 }, (_, i) => i + 1)
  }), []);

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      color: '#f1f5f9',
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    maxWidth: {
      maxWidth: '1280px',
      margin: '0 auto',
      padding: '24px'
    },
    card: {
      backgroundColor: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #334155'
    },
    button: {
      padding: '10px 20px',
      borderRadius: '8px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
      border: 'none'
    },
    primaryButton: {
      backgroundColor: '#0891b2',
      color: 'white'
    },
    secondaryButton: {
      backgroundColor: '#334155',
      color: '#e2e8f0'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.maxWidth}>
        {/* Header */}
        <header style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Incucyte Wound Healing Analyzer</h1>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Automated scratch assay data analysis</p>
            </div>
          </div>
          
          {/* Progress Steps */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { num: 1, label: 'Upload' },
              { num: 2, label: 'Map Wells' },
              { num: 3, label: 'Review' },
              { num: 4, label: 'Results' }
            ].map((s, i) => (
              <React.Fragment key={s.num}>
                <button
                  onClick={() => s.num <= step && setStep(s.num)}
                  disabled={s.num > step}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    border: `1px solid ${step >= s.num ? '#0891b2' : '#334155'}`,
                    backgroundColor: step === s.num ? 'rgba(8, 145, 178, 0.2)' : 'transparent',
                    color: step >= s.num ? '#22d3ee' : '#64748b',
                    cursor: s.num <= step ? 'pointer' : 'default'
                  }}
                >
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    backgroundColor: step >= s.num ? '#0891b2' : '#334155',
                    color: step >= s.num ? 'white' : '#64748b'
                  }}>{s.num}</span>
                  {s.label}
                </button>
                {i < 3 && (
                  <div style={{
                    width: '24px',
                    height: '2px',
                    backgroundColor: step > s.num ? 'rgba(8, 145, 178, 0.5)' : '#334155'
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </header>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0' }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                maxWidth: '500px',
                padding: '48px',
                border: '2px dashed #475569',
                borderRadius: '16px',
                backgroundColor: 'rgba(30, 41, 59, 0.3)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>Upload Incucyte Data File</p>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>Supports .txt and .csv exports</p>
              <span style={{
                ...styles.button,
                ...styles.primaryButton,
                display: 'inline-block'
              }}>Select File</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.tsv"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {/* Step 2: Well Mapping */}
        {step === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '24px' }}>
            {/* Conditions Panel */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Conditions</h2>
                <button
                  onClick={addCondition}
                  style={{ ...styles.button, ...styles.primaryButton, padding: '6px 12px', fontSize: '13px' }}
                >
                  + Add
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {conditions.map((condition, idx) => (
                  <div
                    key={condition.id}
                    onClick={() => setActiveConditionIdx(idx)}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: activeConditionIdx === idx ? '#334155' : 'rgba(51, 65, 85, 0.5)',
                      cursor: 'pointer',
                      border: activeConditionIdx === idx ? '2px solid rgba(8, 145, 178, 0.5)' : '2px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <input
                        type="color"
                        value={condition.color}
                        onChange={(e) => updateCondition(idx, { color: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '20px', height: '20px', border: 'none', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={condition.name}
                        onChange={(e) => updateCondition(idx, { name: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#f1f5f9',
                          fontSize: '14px',
                          fontWeight: '500',
                          outline: 'none'
                        }}
                      />
                      {conditions.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeCondition(idx); }}
                          style={{
                            padding: '4px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {condition.wells.length} wells
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                  Quick Assign to: <span style={{ color: '#22d3ee' }}>{conditions[activeConditionIdx]?.name}</span>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  {['B', 'C', 'D', 'E', 'F', 'G'].map(row => (
                    <button
                      key={row}
                      onClick={() => assignRowToCondition(row, activeConditionIdx, 2, 7)}
                      style={{
                        padding: '6px 8px',
                        fontSize: '11px',
                        backgroundColor: '#334155',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#e2e8f0',
                        cursor: 'pointer'
                      }}
                    >
                      {row}2-7
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Plate Visualization */}
            <div style={styles.card}>
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>96-Well Plate Map</h2>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                  Click wells to assign to <span style={{ color: '#22d3ee' }}>{conditions[activeConditionIdx]?.name}</span>
                </p>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'inline-block' }}>
                  {/* Column headers */}
                  <div style={{ display: 'flex', gap: '4px', marginLeft: '24px', marginBottom: '4px' }}>
                    {plateGrid.cols.map(col => (
                      <div key={col} style={{
                        width: '36px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        color: '#94a3b8'
                      }}>
                        {col}
                      </div>
                    ))}
                  </div>
                  
                  {/* Rows */}
                  {plateGrid.rows.map(row => (
                    <div key={row} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      <div style={{
                        width: '20px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        color: '#94a3b8'
                      }}>
                        {row}
                      </div>
                      {plateGrid.cols.map(col => {
                        const wellName = `${row}${col}`;
                        return (
                          <WellCell
                            key={wellName}
                            well={wellName}
                            hasData={wells.includes(wellName)}
                            condition={getWellCondition(wellName)}
                            isExcluded={excludedWells.has(wellName)}
                            onClick={() => wells.includes(wellName) && assignWellToCondition(wellName, activeConditionIdx)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Legend */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {conditions.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: c.color }} />
                      {c.name} ({c.wells.length})
                    </div>
                  ))}
                </div>
              </div>
              
              <button
                onClick={() => setStep(3)}
                disabled={conditions.every(c => c.wells.length === 0)}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  ...styles.button,
                  ...styles.primaryButton,
                  opacity: conditions.every(c => c.wells.length === 0) ? 0.5 : 1
                }}
              >
                Continue to Review →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Settings */}
        {step === 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            {/* Well Data Preview */}
            <div style={styles.card}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>Review Well Data</h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>Click wells to exclude/include them</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {conditions.map(condition => (
                  <div key={condition.id}>
                    <h3 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: condition.color }} />
                      {condition.name}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
                      {condition.wells.map(well => {
                        const isExcluded = excludedWells.has(well);
                        const stats = getWellStats(well);
                        
                        return (
                          <div
                            key={well}
                            onClick={() => toggleExcludedWell(well)}
                            style={{
                              padding: '12px',
                              borderRadius: '12px',
                              border: '1px solid #475569',
                              backgroundColor: isExcluded ? 'rgba(30, 41, 59, 0.3)' : 'rgba(51, 65, 85, 0.5)',
                              opacity: isExcluded ? 0.5 : 1,
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '500', color: isExcluded ? '#94a3b8' : condition.color }}>
                                {well}
                              </span>
                              {isExcluded && <span style={{ fontSize: '9px', padding: '2px 4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '4px' }}>×</span>}
                            </div>
                            {stats && (
                              <>
                                <Sparkline data={stats.values} color={isExcluded ? '#475569' : condition.color} />
                                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                                  Final: {stats.finalValue.toFixed(1)}%
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Settings Panel */}
            <div style={{ ...styles.card, height: 'fit-content', position: 'sticky', top: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Analysis Settings</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Outlier removal */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoRemoveMinMax}
                    onChange={(e) => setAutoRemoveMinMax(e.target.checked)}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>Remove min/max outliers</span>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                      Excludes highest and lowest values
                    </p>
                  </div>
                </label>
                
                {/* Error bar type */}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Error Bars</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['sem', 'sd'].map(type => (
                      <button
                        key={type}
                        onClick={() => setErrorBarType(type)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: errorBarType === type ? '#0891b2' : '#334155',
                          color: errorBarType === type ? 'white' : '#e2e8f0',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Endpoint timepoint */}
                <div>
                  <label style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Endpoint for Bar Chart</label>
                  <select
                    value={selectedTimepoint}
                    onChange={(e) => setSelectedTimepoint(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#334155',
                      border: '1px solid #475569',
                      color: '#f1f5f9',
                      fontSize: '14px'
                    }}
                  >
                    {timepoints.map(t => (
                      <option key={t} value={t}>{t}h</option>
                    ))}
                  </select>
                </div>
                
                {/* Summary */}
                <div style={{ padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.5)', borderRadius: '12px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: '500', color: '#cbd5e1', marginBottom: '8px' }}>Summary</h3>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Conditions:</span>
                      <span style={{ color: '#e2e8f0' }}>{conditions.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Timepoints:</span>
                      <span style={{ color: '#e2e8f0' }}>{timepoints.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Total wells:</span>
                      <span style={{ color: '#e2e8f0' }}>{conditions.reduce((sum, c) => sum + c.wells.length, 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Excluded:</span>
                      <span style={{ color: excludedWells.size > 0 ? '#fbbf24' : '#e2e8f0' }}>{excludedWells.size}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  onClick={() => setStep(2)}
                  style={{ flex: 1, ...styles.button, ...styles.secondaryButton }}
                >
                  ← Back
                </button>
                <button
                  onClick={processData}
                  style={{ flex: 1, ...styles.button, ...styles.primaryButton }}
                >
                  Analyze →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && processedData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Action bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Analysis Results</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setStep(3)} style={{ ...styles.button, ...styles.secondaryButton }}>
                  ← Edit
                </button>
                <button onClick={exportToCSV} style={{ ...styles.button, ...styles.primaryButton }}>
                  📥 Export CSV
                </button>
              </div>
            </div>
            
            {/* Time Course Graph */}
            <div style={styles.card}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Wound Healing Time Course</h3>
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={processedData.timeCourse} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      label={{ value: 'Time (hours)', position: 'bottom', fill: '#94a3b8', fontSize: 12, dy: 15 }}
                    />
                    <YAxis 
                      stroke="#64748b"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      label={{ value: 'Relative Wound Density (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12, dx: -10 }}
                      domain={[0, 'auto']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: 20 }} />
                    {conditions.map(condition => (
                      <Line
                        key={condition.id}
                        type="monotone"
                        dataKey={`${condition.name}_mean`}
                        name={condition.name}
                        stroke={condition.color}
                        strokeWidth={2}
                        dot={{ fill: condition.color, r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Endpoint Comparison & Statistics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={styles.card}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Endpoint Comparison ({selectedTimepoint}h)</h3>
                <div style={{ height: '320px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        interval={0}
                      />
                      <YAxis 
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        label={{ value: 'Wound Density (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        formatter={(value) => [`${value?.toFixed(2)}%`, 'Mean']}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {barChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                        <ErrorBar dataKey="error" width={4} strokeWidth={2} stroke="#fff" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Statistics Table */}
              <div style={styles.card}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Statistics at {selectedTimepoint}h</h3>
                <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Condition</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Mean</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>SD</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>SEM</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conditions.map(condition => {
                      const stats = processedData.statistics[condition.name] || {};
                      return (
                        <tr key={condition.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: condition.color }} />
                              {condition.name}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>{stats.mean?.toFixed(2)}%</td>
                          <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>±{stats.sd?.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>±{stats.sem?.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '8px', color: '#94a3b8' }}>{stats.n}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.3)', borderRadius: '12px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: '500', color: '#94a3b8', marginBottom: '6px' }}>Analysis Parameters</h4>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    <div>• Error bars: {errorBarType.toUpperCase()}</div>
                    <div>• Min/Max removal: {autoRemoveMinMax ? 'Enabled' : 'Disabled'}</div>
                    <div>• Manually excluded: {excludedWells.size} wells</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Full Data Table */}
            <div style={styles.card}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Complete Time Course Data</h3>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e293b' }}>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Time (h)</th>
                      {conditions.map(c => (
                        <th key={c.id} style={{ textAlign: 'right', padding: '8px', color: c.color }}>
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {processedData.timeCourse.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>{row.time}</td>
                        {conditions.map(c => (
                          <td key={c.id} style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
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
        
        {/* Footer */}
        <footer style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px solid rgba(51, 65, 85, 0.5)', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#64748b' }}>
            Incucyte Wound Healing Analyzer • For Sartorius Incucyte ZOOM Scratch Assay Data
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
