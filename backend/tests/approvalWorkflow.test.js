import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSubmitSuccessMessage,
  canReviewGoalSheet,
  isReviewableByAdmin,
} from '../utils/approvalWorkflow.js';

describe('approvalWorkflow', () => {
  it('manager sheets go to Admin', () => {
    assert.equal(getSubmitSuccessMessage('Manager'), 'Submitted to Admin for approval.');
    assert.equal(getSubmitSuccessMessage('Employee'), 'Submitted to your manager for approval.');
    assert.match(getSubmitSuccessMessage('Admin'), /no manager approval/i);
  });

  it('admin can review managers and employees', () => {
    const admin = { id: 1, role: 'Admin' };
    const manager = { id: 2, role: 'Manager', manager_id: 1 };
    const employee = { id: 3, role: 'Employee', manager_id: 2 };
    assert.equal(canReviewGoalSheet(admin, manager), true);
    assert.equal(canReviewGoalSheet(admin, employee), true);
    assert.equal(isReviewableByAdmin(manager, 1), true);
    assert.equal(isReviewableByAdmin(admin, 1), false);
  });

  it('manager can only review direct-report employees', () => {
    const manager = { id: 2, role: 'Manager' };
    const employee = { id: 3, role: 'Employee', manager_id: 2 };
    const otherManager = { id: 4, role: 'Manager', manager_id: 1 };
    assert.equal(canReviewGoalSheet(manager, employee), true);
    assert.equal(canReviewGoalSheet(manager, otherManager), false);
  });
});
