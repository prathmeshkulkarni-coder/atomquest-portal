import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSheetUserId } from '../utils/goalValidation.js';

describe('createGoal authorization (resolveSheetUserId)', () => {
  const manager = { id: 2, role: 'Manager' };
  const employee = { id: 3, role: 'Employee' };

  it('defaults to requester when userId omitted', () => {
    assert.deepEqual(resolveSheetUserId(manager, undefined), {
      ok: true,
      userId: 2,
    });
  });

  it('lets manager create goals on a direct report sheet', () => {
    assert.deepEqual(resolveSheetUserId(manager, 9), {
      ok: true,
      userId: 9,
      requiresManagerCheck: true,
    });
  });

  it('blocks employee from creating goals for someone else', () => {
    const result = resolveSheetUserId(employee, 9);
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  });
});
