import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ErrorBar, Cell } from 'recharts';
import { CHART_THEMES } from '../../utils/constants';

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
  outlierMethod,
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
                label={{ value: xAxisLabel, position: 'insideBottom', offset: -5, fill: theme.textColor, fontSize: 13, fontFamily: 'Arial, sans-serif' }}
              />
              <YAxis
                stroke={theme.axisColor}
                tick={{ fill: theme.tickColor, fontSize: 12, fontFamily: 'Arial, sans-serif' }}
                tickLine={{ stroke: theme.axisColor }}
                axisLine={{ stroke: theme.axisColor }}
                domain={[0, 'auto']}
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
                <Line key={condition.id} type="monotone" dataKey={`${condition.name}_mean`} name={condition.name}
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
                  label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: theme.textColor, fontSize: 12, fontFamily: 'Arial, sans-serif', dx: -10, dy: 0, style: { textAnchor: 'middle' } }}
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
  );
};

export default ResultsStep;
