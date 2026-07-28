import React, { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ErrorBar, Cell } from 'recharts';
import { CHART_THEMES } from '../../utils/constants';
import { computeYAxisScale, collectTimeCourseValues, collectBarValues } from '../../utils/chartAxis';

/** Absent values print as an em dash so a gap never reads as a measured 0. */
const fmt = (v, digits = 2, suffix = '%') =>
  typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(digits)}${suffix}` : '—';

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
          {entry.name}: {fmt(entry.value)}
        </p>
      ))}
    </div>
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

const ResultsStep = ({
  processedData,
  conditions,
  errorBarType,
  selectedTimepoint,
  timepoints,
  figureTitle,
  xAxisLabel,
  yAxisLabel,
  chartTheme,
  setChartTheme,
  showExportPanel,
  setShowExportPanel,
  isExporting,
  exportToPNG,
  exportToCSV,
  fileName,
  timeCourseRef,
  barChartRef,
  barChartData,
  filteredTimeCourse,
  timeCourseEndpoint,
  setTimeCourseEndpoint,
  yAxisScale,
  setYAxisScale,
  outlierMethod,
  keyOf,
  qcReport,
  setStep,
  styles
}) => {
  const theme = CHART_THEMES[chartTheme];
  const chartCard = {
    backgroundColor: theme.cardBg,
    borderRadius: '12px',
    padding: '24px',
    border: theme.background === '#ffffff' ? '1px solid #e5e7eb' : '1px solid #334155'
  };

  // Both charts show the same metric, so they share one scaling rule: whichever
  // is on screen, 60% closure has to look like 60% closure.
  const fullScale = yAxisScale === 'full';

  const timeCourseAxis = useMemo(
    () => computeYAxisScale(
      collectTimeCourseValues(filteredTimeCourse, conditions, keyOf),
      { fullScale }
    ),
    [filteredTimeCourse, conditions, keyOf, fullScale]
  );

  const barAxis = useMemo(
    () => computeYAxisScale(collectBarValues(barChartData), { fullScale }),
    [barChartData, fullScale]
  );

  const selectStyle = {
    padding: '4px 8px',
    borderRadius: '6px',
    backgroundColor: theme.background === '#ffffff' ? '#f3f4f6' : '#334155',
    border: `1px solid ${theme.gridColor}`,
    color: theme.textColor,
    fontSize: '12px'
  };

  return (
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
      
      <div style={chartCard} ref={timeCourseRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: theme.textColor }}>
            Wound Healing Time Course
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="timecourse-endpoint" style={{ fontSize: '12px', color: theme.tickColor }}>Show until:</label>
              <select
                id="timecourse-endpoint"
                value={timeCourseEndpoint === null ? '' : timeCourseEndpoint}
                onChange={(e) => setTimeCourseEndpoint(e.target.value === '' ? null : Number(e.target.value))}
                style={selectStyle}
              >
                <option value="">All ({Math.max(...timepoints)}h)</option>
                {timepoints.filter(t => t > 0).map(t => (
                  <option key={t} value={t}>{t}h</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="y-axis-scale" style={{ fontSize: '12px', color: theme.tickColor }}>Y-axis:</label>
              <select
                id="y-axis-scale"
                value={yAxisScale}
                onChange={(e) => setYAxisScale(e.target.value)}
                style={selectStyle}
                title="Full scale keeps 0–100% on screen so different experiments can be compared. Fit to data zooms in on a small effect."
              >
                <option value="full">Full scale (0–100%)</option>
                <option value="fit">Fit to data</option>
              </select>
            </div>
          </div>
        </div>
        <p style={{ fontSize: '11px', color: theme.tickColor, marginBottom: '16px' }}>
          Data shown as mean ± {errorBarType.toUpperCase()} (n={conditions[0] ? (processedData.statistics[keyOf(conditions[0])]?.n || 0) : 0})
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
                label={{ value: xAxisLabel, position: 'insideBottom', offset: -5, fill: theme.textColor, fontSize: 13, fontFamily: 'Arial, sans-serif' }}
              />
              <YAxis
                stroke={theme.axisColor}
                tick={{ fill: theme.tickColor, fontSize: 12, fontFamily: 'Arial, sans-serif' }}
                tickLine={{ stroke: theme.axisColor }}
                axisLine={{ stroke: theme.axisColor }}
                // Domain and ticks are chosen together in chartAxis.js. Handing
                // Recharts a bare dataMax made it label the top of the axis with
                // the raw data maximum and stop short of 100%.
                domain={timeCourseAxis.domain}
                ticks={timeCourseAxis.ticks}
                label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: theme.textColor, fontSize: 13, fontFamily: 'Arial, sans-serif', dx: -10, dy: 0, style: { textAnchor: 'middle' } }}
              />
              <Tooltip content={<CustomTooltip theme={chartTheme} />} />
              <Legend 
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ paddingTop: '20px', fontFamily: 'Arial, sans-serif' }}
                formatter={(value) => <span style={{ color: theme.textColor, fontSize: '12px' }}>{value}</span>}
              />
              {conditions.map(condition => (
                <Line key={condition.id} type="monotone" dataKey={`${keyOf(condition)}_mean`} name={condition.name}
                  stroke={condition.color} strokeWidth={2.5} dot={{ fill: condition.color, r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={chartCard} ref={barChartRef}>
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
                  // Same scaling rule as the time course, and wide enough for
                  // the error bars rather than just the bar tops.
                  domain={barAxis.domain}
                  ticks={barAxis.ticks}
                  label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: theme.textColor, fontSize: 12, fontFamily: 'Arial, sans-serif', dx: -10, dy: 0, style: { textAnchor: 'middle' } }}
                />
                <Tooltip contentStyle={{ backgroundColor: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, borderRadius: '8px', color: theme.textColor }}
                  formatter={(value, name, props) => [`${fmt(value)} ± ${fmt(props.payload.error, 2, '')} (n=${props.payload.n})`, 'Mean']} />
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
                <th style={{ textAlign: 'right', padding: '8px' }}
                  title={processedData.correctionMethod === 'Uncorrected'
                    ? 'Raw two-tailed Welch p-value, not adjusted for multiple comparisons'
                    : `Adjusted for ${processedData.comparisonCount} comparisons (${processedData.correctionMethod}); raw value in parentheses`}>
                  p-value{processedData.correctionMethod !== 'Uncorrected' && <span style={{ fontSize: '9px', color: '#22d3ee' }}> adj.</span>}
                </th>
                <th style={{ textAlign: 'center', padding: '8px' }}>Sig.</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>Rep. Wells (Top 3)</th>
              </tr>
            </thead>
            <tbody>
              {conditions.map(condition => {
                const k = keyOf(condition);
                const stats = processedData.statistics[k] || {};
                const pVal = processedData.pValues[k] || {};
                const isControl = k === processedData.controlKey;
                return (
                  <tr key={condition.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: condition.color }} />
                        {condition.name}{isControl && <span style={{ fontSize: '9px', color: '#4ade80' }}>(ref)</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
                      {fmt(stats.mean, 2, '')} ± {fmt(stats[errorBarType], 2)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px', color: '#94a3b8' }}>{stats.n ?? 0}</td>
                    <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>
                      {isControl ? '-' : pVal.testable === false ? (
                        <span title={pVal.reason || 'not testable'} style={{ color: '#64748b' }}>n/a</span>
                      ) : (
                        <>
                          {pVal.p < 0.0001 ? pVal.p?.toExponential(2) : pVal.p?.toFixed(4)}
                          {processedData.correctionMethod !== 'Uncorrected' && pVal.pRaw != null && (
                            <div style={{ fontSize: '10px', color: '#64748b' }}>
                              raw {pVal.pRaw < 0.0001 ? pVal.pRaw.toExponential(2) : pVal.pRaw.toFixed(4)}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px', color: '#fbbf24', fontWeight: 'bold' }}>{pVal.stars || '-'}</td>
                    <td style={{ textAlign: 'right', padding: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>
                      {processedData.representativeWells?.[k]?.length > 0
                        ? processedData.representativeWells[k].map((rw, i) => (
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
                    <td style={{ textAlign: 'right', padding: '4px', fontFamily: 'monospace' }}>{processedData.auc[keyOf(condition)]?.toFixed(1)}</td>
                    <td style={{ textAlign: 'right', padding: '4px', fontFamily: 'monospace', color: '#4ade80' }}>{processedData.auc[`${keyOf(condition)}_relative`] != null ? `${processedData.auc[`${keyOf(condition)}_relative`]}%` : 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.3)', borderRadius: '12px', fontSize: '11px', color: '#64748b' }}>
            <div>• Endpoint: {selectedTimepoint}h • Error: {errorBarType.toUpperCase()}</div>
            <div>• Outlier removal: {outlierMethod === 'none' ? 'None' : outlierMethod === 'minmax' ? 'Min/Max' : 'Best Triplicate'} • Test: Welch's t-test</div>
            <div>
              • Multiple-comparison correction: {processedData.correctionMethod}
              {processedData.comparisonCount > 0 && ` (${processedData.comparisonCount} comparison${processedData.comparisonCount > 1 ? 's' : ''})`}
            </div>
            {Object.keys(qcReport || {}).length > 0 && (
              <div>• QC flagged {Object.keys(qcReport).length} well{Object.keys(qcReport).length > 1 ? 's' : ''} — see the exported CSV for details</div>
            )}
            {processedData.untestedCount > 0 && (
              <div style={{ color: '#fcd34d', marginTop: '4px' }}>
                ⚠ {processedData.untestedCount} condition{processedData.untestedCount > 1 ? 's' : ''} could not be
                tested (fewer than 2 replicates) and {processedData.untestedCount > 1 ? 'are' : 'is'} excluded from the
                correction family — shown as n/a rather than counted as non-significant.
              </div>
            )}
            {outlierMethod === 'bestTriplicate' && (
              <div style={{ color: '#fcd34d', marginTop: '4px' }}>
                ⚠ Best Triplicate is a selection rule; SD/SEM are biased low and p-values are anti-conservative.
              </div>
            )}
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
                      {fmt(row[`${keyOf(c)}_mean`], 2, '')} <span style={{ color: '#64748b' }}>± {fmt(row[`${keyOf(c)}_${errorBarType}`], 2, '')}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ResultsStep;
