import { normalizeUomDirection } from './uom.js';

/** Progress score formulas per BRD (tracking only, not ratings). */
export const calculateScore = (uom, target, actual, uomDirection = 'Min') => {
  try {
    const tgt = parseFloat(target);
    const act = parseFloat(actual);
    const direction = normalizeUomDirection(uom, uomDirection) || 'Min';

    if (uom === 'Zero-based') {
      return act === 0 ? 100 : 0;
    }

    if (uom === 'Timeline') {
      const tgtDate = new Date(target);
      const actDate = new Date(actual);
      if (!isNaN(tgtDate) && !isNaN(actDate)) {
        return actDate <= tgtDate ? 100 : 0;
      }
      return actual.toString().trim().toLowerCase() === target.toString().trim().toLowerCase() ? 100 : 0;
    }

    if (!isNaN(tgt) && !isNaN(act)) {
      if (tgt === 0) return 0;

      if (direction === 'Max') {
        if (act === 0) return 100;
        const score = (tgt / act) * 100;
        return Math.min(Math.max(parseFloat(score.toFixed(2)), 0), 200);
      }

      const score = (act / tgt) * 100;
      return Math.min(Math.max(parseFloat(score.toFixed(2)), 0), 200);
    }

    return actual === target ? 100 : 0;
  } catch {
    return 0;
  }
};
