/** Normalize GET /api/goals response (supports legacy array or { goals, sheetStatus }). */
export const parseGoalsResponse = (data) => {
  if (Array.isArray(data)) {
    return { goals: data, sheetStatus: 'draft' };
  }
  return {
    goals: data?.goals ?? [],
    sheetStatus: data?.sheetStatus ?? 'draft',
  };
};
