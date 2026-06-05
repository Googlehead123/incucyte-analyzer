import React from 'react';
import { isEdgeWell, countEdgeWells } from '../../utils/plate';

const WellCell = ({ well, hasData, condition, isExcluded, onClick, onMouseDown, onMouseEnter, onMouseUp, isDragSelected, activeColor, isEdge }) => {
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
      style={{ ...baseStyle, position: 'relative' }}
      title={hasData ? `${well}${isEdge ? ' (edge well)' : ''}${condition ? ` - ${condition.name}` : ''}${isExcluded ? ' (Excluded)' : ''}` : 'No data'}>
      {hasData && well.slice(1)}
      {hasData && isEdge && (
        <span
          aria-hidden="true"
          style={{ position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }}
        />
      )}
    </button>
  );
};

const PlateMapStep = ({
  conditions,
  activeConditionIdx,
  setActiveConditionIdx,
  controlConditionIdx,
  setControlConditionIdx,
  addCondition,
  removeCondition,
  updateCondition,
  assignWellToCondition,
  assignRowToCondition,
  assignColumnToCondition,
  reorderConditions,
  getWellCondition,
  wells,
  excludedWells,
  isDragging,
  dragSelectedWells,
  handleDragStart,
  handleDragEnter,
  handleDragEnd,
  draggedConditionIdx,
  setDraggedConditionIdx,
  dragOverConditionIdx,
  setDragOverConditionIdx,
  dragHandledRef,
  plateGrid,
  setStep,
  styles
}) => {
  // Derive the actually-populated rows/columns so Quick-Assign adapts to the
  // uploaded layout: middle-60 files show B–G / 2–11, full-plate files show
  // A–H / 1–12. The App.jsx handlers already drop non-existent wells, so the
  // ranges only need to be widened here.
  const presentRows = [...new Set(wells.map(w => w.charAt(0)))].sort();
  const presentCols = [...new Set(wells.map(w => parseInt(w.slice(1), 10)))].sort((a, b) => a - b);
  const minCol = presentCols[0];
  const maxCol = presentCols[presentCols.length - 1];
  const minRow = presentRows[0];
  const maxRow = presentRows[presentRows.length - 1];
  const hasWells = presentRows.length > 0 && presentCols.length > 0;

  // Edge wells currently assigned across all conditions (non-blocking warning).
  const assignedEdgeCount = conditions.reduce((sum, c) => sum + countEdgeWells(c.wells, excludedWells), 0);

  return (
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
                <div style={{ position: 'relative', width: '28px', height: '28px', flexShrink: 0 }}>
                  <div
                    onClick={(e) => { e.stopPropagation(); e.currentTarget.nextElementSibling.click(); }}
                    title="Click to change color"
                    style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: condition.color, border: '2px solid #94a3b8', cursor: 'pointer', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }}
                  />
                  <input type="color" value={condition.color} onChange={(e) => updateCondition(idx, { color: e.target.value })} onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: 0, left: 0, width: '28px', height: '28px', opacity: 0, cursor: 'pointer' }} />
                </div>
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
        
        {hasWells && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Quick Assign: <span style={{ color: '#22d3ee' }}>{conditions[activeConditionIdx]?.name}</span></p>
            <p style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>Rows (horizontal)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {presentRows.map(row => (
                <button key={row} onClick={() => assignRowToCondition(row, activeConditionIdx, minCol, maxCol)}
                  style={{ padding: '6px', fontSize: '11px', backgroundColor: '#334155', border: 'none', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer' }}>
                  {minCol === maxCol ? `${row}${minCol}` : `${row}${minCol}-${row}${maxCol}`}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px', marginBottom: '6px' }}>Columns (vertical)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
              {presentCols.map(col => (
                <button key={col} onClick={() => assignColumnToCondition(col, activeConditionIdx, minRow, maxRow)}
                  style={{ padding: '6px', fontSize: '11px', backgroundColor: '#334155', border: 'none', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer' }}>
                  {minRow === maxRow ? `${minRow}${col}` : `${minRow}${col}-${maxRow}${col}`}
                </button>
              ))}
            </div>
          </div>
        )}
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
                      isEdge={isEdgeWell(wellName)}
                      isDragSelected={dragSelectedWells.has(wellName)}
                      activeColor={conditions[activeConditionIdx]?.color || '#22d3ee'}
                      onClick={() => {
                        if (dragHandledRef?.current) return;
                        if (!isDragging && hasWellData) assignWellToCondition(wellName, activeConditionIdx);
                      }}
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

        {assignedEdgeCount > 0 && (
          <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.4)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#fbbf24' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }} />
            <span>{assignedEdgeCount} edge well{assignedEdgeCount > 1 ? 's' : ''} assigned — edge wells can drift from evaporation/thermal effects. Review or exclude them on the next step.</span>
          </div>
        )}

        <button onClick={() => setStep(3)} disabled={conditions.every(c => c.wells.length === 0)}
          style={{ width: '100%', marginTop: '16px', ...styles.button, ...styles.primaryButton, opacity: conditions.every(c => c.wells.length === 0) ? 0.5 : 1 }}>
          Continue to Review →
        </button>
      </div>
    </div>
  );
};

export default PlateMapStep;
