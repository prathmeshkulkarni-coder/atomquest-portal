import { describe, it, expect } from 'vitest';
import { UOM_OPTIONS, parseUomSelection, toUomSelectionKey, formatUom } from './uom';

describe('uom constants', () => {
  it('parses Min/Max selection keys', () => {
    expect(parseUomSelection('Numeric|Min')).toEqual({ uom: 'Numeric', uom_direction: 'Min' });
    expect(parseUomSelection('%|Max')).toEqual({ uom: '%', uom_direction: 'Max' });
    expect(parseUomSelection('Timeline')).toEqual({ uom: 'Timeline', uom_direction: null });
  });

  it('builds selection keys', () => {
    expect(toUomSelectionKey('Numeric', 'Max')).toBe('Numeric|Max');
    expect(toUomSelectionKey('Timeline', null)).toBe('Timeline');
  });

  it('formats labels for display', () => {
    expect(formatUom('%', 'Min')).toContain('Min');
    expect(formatUom('Timeline', null)).toContain('Timeline');
  });

  it('exposes all BRD UoM options', () => {
    expect(UOM_OPTIONS.length).toBeGreaterThanOrEqual(6);
  });
});
