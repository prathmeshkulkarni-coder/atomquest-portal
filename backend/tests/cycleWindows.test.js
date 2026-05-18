import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGoalSettingOpen,
  isQuarterCheckinOpen,
  assertGoalSettingWindow,
  assertCheckinWindow,
  buildCycleStatus,
} from '../utils/cycleWindows.js';

describe('cycleWindows BRD §2.3', () => {
  it('opens goal setting in May', () => {
    assert.equal(isGoalSettingOpen(new Date('2026-05-15')), true);
    assert.equal(isGoalSettingOpen(new Date('2026-07-01')), false);
  });

  it('opens Q1 only in July', () => {
    assert.equal(isQuarterCheckinOpen('Q1', new Date('2026-07-10')), true);
    assert.equal(isQuarterCheckinOpen('Q1', new Date('2026-10-10')), false);
  });

  it('opens Q4 and Annual in March–April', () => {
    assert.equal(isQuarterCheckinOpen('Q4', new Date('2026-03-15')), true);
    assert.equal(isQuarterCheckinOpen('Annual', new Date('2026-04-20')), true);
    assert.equal(isQuarterCheckinOpen('Q4', new Date('2026-05-01')), false);
  });

  it('blocks goal edits outside window when enforcement on', () => {
    const result = assertGoalSettingWindow(new Date('2026-12-01'), {
      enforcementEnabled: true,
      bypass: false,
    });
    assert.equal(result.allowed, false);
  });

  it('allows bypass for demo', () => {
    const result = assertCheckinWindow('Q1', new Date('2026-12-01'), { bypass: true });
    assert.equal(result.allowed, true);
  });

  it('buildCycleStatus marks windows when bypass', () => {
    const status = buildCycleStatus(new Date('2026-12-01'), { bypass: true });
    assert.equal(status.windows.every((w) => w.isOpen), true);
  });
});
