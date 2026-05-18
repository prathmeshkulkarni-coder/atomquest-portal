import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canBypassGoalSettingWindow, assertGoalSettingForRole } from '../utils/cycleGuards.js';

describe('cycleGuards', () => {
  it('allows Manager and Admin to bypass closed goal-setting window', () => {
    assert.equal(canBypassGoalSettingWindow('Manager'), true);
    assert.equal(canBypassGoalSettingWindow('Admin'), true);
    assert.equal(canBypassGoalSettingWindow('Employee'), false);
  });

  it('blocks employees when window is closed', () => {
    const closed = { allowed: false, message: 'closed' };
    assert.deepEqual(assertGoalSettingForRole(closed, 'Employee'), closed);
    assert.deepEqual(assertGoalSettingForRole(closed, 'Manager'), { allowed: true });
  });
});
