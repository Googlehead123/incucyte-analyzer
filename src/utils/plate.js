// 96-well plate geometry (8 rows A–H × 12 columns).
// Edge wells = the outer ring (row A, row H, column 1, column 12). They are
// scientifically suspect in wound-healing assays (faster evaporation, thermal
// gradients), which is why the classic layout leaves them empty and uses only
// the inner B–G × 2–11 block.

export const isEdgeWell = (well) => {
  if (!well) return false;
  const row = well.charAt(0);
  const col = parseInt(well.slice(1), 10);
  if (Number.isNaN(col)) return false;
  return row === 'A' || row === 'H' || col === 1 || col === 12;
};

// Count edge wells in a list, optionally excluding a Set of excluded wells.
export const countEdgeWells = (wells, excludedWells) =>
  (wells || []).filter(w => isEdgeWell(w) && !(excludedWells?.has(w))).length;
