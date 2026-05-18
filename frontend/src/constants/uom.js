export const UOM_OPTIONS = [
  { value: 'Numeric', direction: 'Min', label: 'Numeric — higher is better (Min)' },
  { value: 'Numeric', direction: 'Max', label: 'Numeric — lower is better (Max)' },
  { value: '%', direction: 'Min', label: '% — higher is better (Min)' },
  { value: '%', direction: 'Max', label: '% — lower is better (Max)' },
  { value: 'Timeline', direction: null, label: 'Timeline (date deadline)' },
  { value: 'Zero-based', direction: null, label: 'Zero-based (zero = success)' },
];

export const formatUom = (uom, uomDirection) => {
  const match = UOM_OPTIONS.find(
    (o) => o.value === uom && (o.direction === uomDirection || (o.direction === null && !uomDirection))
  );
  if (match) return match.label;
  if (uom === 'Timeline' || uom === 'Zero-based') return uom;
  return `${uom} (${uomDirection || 'Min'})`;
};

export const parseUomSelection = (selectionKey) => {
  const [uom, direction] = selectionKey.split('|');
  if (uom === 'Timeline' || uom === 'Zero-based') return { uom, uom_direction: null };
  return { uom, uom_direction: direction || 'Min' };
};

export const toUomSelectionKey = (uom, uomDirection) => {
  if (uom === 'Timeline' || uom === 'Zero-based') return uom;
  return `${uom}|${uomDirection || 'Min'}`;
};
