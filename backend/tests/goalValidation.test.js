import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWeightageTotalValid,
  isIndividualWeightageValid,
  canAddGoal,
  resolveSubmitUserId,
  MAX_GOALS,
} from '../utils/goalValidation.js';

describe('goalValidation', () => {
  it('validates weightage totals', () => {
    assert.equal(isWeightageTotalValid([{ weightage: 60 }, { weightage: 40 }]), true);
    assert.equal(isWeightageTotalValid([{ weightage: 50 }, { weightage: 40 }]), false);
  });

  it('validates individual minimum weightage', () => {
    assert.equal(isIndividualWeightageValid(10), true);
    assert.equal(isIndividualWeightageValid(9), false);
  });

  it('enforces max goals', () => {
    assert.equal(canAddGoal(7), true);
    assert.equal(canAddGoal(MAX_GOALS), false);
  });

  it('allows employees to submit only their own sheet', () => {
    const employee = { id: 5, role: 'Employee' };
    assert.deepEqual(resolveSubmitUserId(employee, undefined), { ok: true, userId: 5 });
    const denied = resolveSubmitUserId(employee, 9);
    assert.equal(denied.ok, false);
    assert.equal(denied.status, 403);
  });

  it('allows admin to submit on behalf of others', () => {
    const admin = { id: 1, role: 'Admin' };
    assert.deepEqual(resolveSubmitUserId(admin, 9), { ok: true, userId: 9 });
  });

  it('allows manager submit with hierarchy check flag', () => {
    const manager = { id: 2, role: 'Manager' };
    assert.deepEqual(resolveSubmitUserId(manager, 9), {
      ok: true,
      userId: 9,
      requiresManagerCheck: true,
    });
  });
});
