import React from 'react';
import { isEdgeWell, countEdgeWells } from '../../utils/plate';

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
  correctionMethod,
  setCorrectionMethod,
  errorBarType,
  setErrorBarType,
  selectedTimepoint,
  setSelectedTimepoint,
  timepoints,
  qcReport,
  qcCounts,
  scanFailures,
  unresolvedQcWells,
  excludeAllFlaggedWells,
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

        {scanFailures?.length > 0 && (
          <div role="status" style={{ marginBottom: '12px', padding: '12px 14px', borderRadius: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.35)' }}>
            <div style={{ fontSize: '12px', color: '#93c5fd', lineHeight: 1.5 }}>
              <strong>Possible failed scan{scanFailures.length > 1 ? 's' : ''}:</strong>{' '}
              {scanFailures.slice(0, 3).map(f => `${f.wells} wells at ${f.time}h`).join('; ')}
              {scanFailures.length > 3 && `; and ${scanFailures.length - 3} more timepoint${scanFailures.length - 3 > 1 ? 's' : ''}`}
              {' '}show the same isolated anomaly. When a whole timepoint misbehaves the imaging run is
              usually at fault rather than the wells — consider ending the time course before it
              (&ldquo;Show until&rdquo; on the results chart) instead of excluding wells.
              {scanFailures.length > 3 && (
                <> This many affected timepoints suggests a problem with the run itself; the plate may
                need re-imaging rather than filtering.</>
              )}
            </div>
          </div>
        )}

        {qcCounts?.total > 0 && (
          <div role="status" style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '12px',
            backgroundColor: qcCounts.high > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            border: `1px solid ${qcCounts.high > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '12px', color: qcCounts.high > 0 ? '#fca5a5' : '#fcd34d' }}>
                <strong>Quality check:</strong>{' '}
                {qcCounts.high > 0 && <>{qcCounts.high} well{qcCounts.high > 1 ? 's' : ''} look like segmentation failures</>}
                {qcCounts.high > 0 && qcCounts.low > 0 && ', '}
                {qcCounts.low > 0 && <>{qcCounts.low} with minor issues</>}
                . Nothing has been removed — review the flagged wells below.
              </div>
              {unresolvedQcWells?.length > 0 && (
                <button onClick={excludeAllFlaggedWells}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.5)',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', fontSize: '12px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Exclude all {unresolvedQcWells.length} flagged
                </button>
              )}
            </div>
          </div>
        )}

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
                  const qc = qcReport?.[well];
                  const qcHigh = qc?.severity === 'high';
                  const qcTitle = qc ? qc.flags.map(f => f.message).join('\n') : undefined;
                  return (
                    <div key={well} onClick={() => toggleExcludedWell(well)}
                      title={qcTitle}
                      style={{ padding: '12px', borderRadius: '12px',
                        border: !isExcluded && qc ? `1px solid ${qcHigh ? 'rgba(239, 68, 68, 0.6)' : 'rgba(245, 158, 11, 0.5)'}` : '1px solid #475569',
                        backgroundColor: isExcluded ? 'rgba(30, 41, 59, 0.3)' : 'rgba(51, 65, 85, 0.5)', opacity: isExcluded ? 0.5 : 1, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: isExcluded ? '#94a3b8' : condition.color }}>{well}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {qc && !isExcluded && (
                            <span title={qcTitle} style={{ fontSize: '9px', padding: '2px 4px', borderRadius: '4px',
                              backgroundColor: qcHigh ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: qcHigh ? '#f87171' : '#fbbf24' }}>
                              {qcHigh ? '⚠ QC' : 'QC'}
                            </span>
                          )}
                          {isEdgeWell(well) && <span title="Edge well — prone to evaporation/thermal effects" style={{ fontSize: '9px', padding: '2px 4px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderRadius: '4px' }}>edge</span>}
                          {isExcluded && <span style={{ fontSize: '9px', padding: '2px 4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '4px' }}>×</span>}
                        </span>
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
            {outlierMethod === 'bestTriplicate' && (
              <p style={{ fontSize: '11px', color: '#fcd34d', margin: '8px 0 0 0', padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.12)', lineHeight: 1.45 }}>
                This is a <strong>selection rule, not outlier rejection</strong>. Choosing the least-variable
                triplicate shrinks SD/SEM and makes p-values anti-conservative. Disclose it if you publish these numbers.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="correction-method" style={{ fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Multiple-Comparison Correction</label>
            <select id="correction-method" value={correctionMethod} onChange={(e) => setCorrectionMethod(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#334155', border: '1px solid #475569', color: '#f1f5f9', fontSize: '14px' }}>
              <option value="none">None (uncorrected)</option>
              <option value="holmSidak">Holm–Šidák</option>
              <option value="bonferroni">Bonferroni</option>
            </select>
            {conditions.length > 2 && correctionMethod === 'none' && (
              <p style={{ fontSize: '11px', color: '#fcd34d', margin: '8px 0 0 0', padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.12)', lineHeight: 1.45 }}>
                {conditions.length - 1} treatments are each tested against the control. Uncorrected, the chance
                of at least one false positive is about {Math.round((1 - Math.pow(0.95, conditions.length - 1)) * 100)}%.
              </p>
            )}
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
            {(() => {
              const edgeCount = conditions.reduce((sum, c) => sum + countEdgeWells(c.wells, excludedWells), 0);
              return edgeCount > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Edge wells:</span><span style={{ color: '#fbbf24' }}>{edgeCount}</span></div>
              ) : null;
            })()}
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
