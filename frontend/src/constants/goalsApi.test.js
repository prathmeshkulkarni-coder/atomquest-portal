import { describe, it, expect } from 'vitest';
import { parseGoalsResponse } from './goalsApi';

describe('parseGoalsResponse', () => {
  it('handles legacy array', () => {
    expect(parseGoalsResponse([{ id: 1 }])).toEqual({ goals: [{ id: 1 }], sheetStatus: 'draft' });
  });

  it('handles wrapped response', () => {
    expect(parseGoalsResponse({ goals: [{ id: 2 }], sheetStatus: 'submitted' })).toEqual({
      goals: [{ id: 2 }],
      sheetStatus: 'submitted',
    });
  });
});
