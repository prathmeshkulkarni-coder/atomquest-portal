/** BRD UoM types with explicit Min / Max for Numeric and %. */

export const UOM_TYPES = ['Numeric', '%', 'Timeline', 'Zero-based'];
export const UOM_DIRECTIONS = ['Min', 'Max'];

export const normalizeUomDirection = (uom, direction) => {
  if (uom === 'Timeline' || uom === 'Zero-based') return null;
  return direction === 'Max' ? 'Max' : 'Min';
};

export const formatUomLabel = (uom, direction = 'Min') => {
  if (uom === 'Timeline') return 'Timeline (date deadline)';
  if (uom === 'Zero-based') return 'Zero-based (zero = success)';
  if (direction === 'Max') {
    return uom === '%' ? '% — lower is better (Max)' : 'Numeric — lower is better (Max)';
  }
  return uom === '%' ? '% — higher is better (Min)' : 'Numeric — higher is better (Min)';
};

export const requiresDirection = (uom) => uom === 'Numeric' || uom === '%';
