import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Documents delete ordering: audit row must be inserted before goal row is removed
 * because audit_logs.goal_id REFERENCES goals(id).
 */
describe('goal delete audit ordering', () => {
  it('requires goal to exist when inserting audit log', () => {
    const steps = [];
    const goalExists = () => steps.filter((s) => s === 'insert_goal').length > steps.filter((s) => s === 'delete_goal').length;

    const insertAudit = () => {
      assert.equal(goalExists(), true, 'audit insert must happen before goal delete');
      steps.push('insert_audit');
    };
    const deleteGoal = () => {
      steps.push('delete_goal');
    };

    steps.push('insert_goal');
    insertAudit();
    deleteGoal();

    assert.deepEqual(steps, ['insert_goal', 'insert_audit', 'delete_goal']);
  });
});
