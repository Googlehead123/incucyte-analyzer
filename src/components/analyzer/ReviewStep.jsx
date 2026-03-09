import React from 'react';

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

const ReviewStep = ({
  conditions,
  excludedWells,
  toggleExcludedWell,
  getWellStats,
  outlierMethod,
  setOutlierMethod,
  errorBarType,
  setErrorBarType,
  selectedTimepoint,
  setSelectedTimepoint,
  timepoints,
  figureTitle,
  setFigureTitle,
  controlConditionIdx,
  processData,
  setStep,
  styles
}) => {
  return (
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
  );
};

export default ReviewStep;
