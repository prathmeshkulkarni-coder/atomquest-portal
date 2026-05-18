import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessGoal } from '../utils/goalAccess.js';

describe('goalAccess', () => {
  const employee = { id: 3, role: 'Employee', manager_id: 2 };
  const manager = { id: 2, role: 'Manager' };
  const admin = { id: 1, role: 'Admin' };
  const other = { id: 9, role: 'Employee', manager_id: 99 };
  const goal = { id: 10, user_id: 3 };

  it('allows owner and admin', () => {
    assert.equal(canAccessGoal(employee, goal, employee), true);
    assert.equal(canAccessGoal(admin, goal, employee), true);
  });

  it('allows manager for direct report', () => {
    assert.equal(canAccessGoal(manager, goal, employee), true);
  });

  it('denies unrelated employee', () => {
    assert.equal(canAccessGoal(other, goal, employee), false);
  });
});
