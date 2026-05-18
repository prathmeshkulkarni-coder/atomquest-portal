import { describe, it, expect } from 'vitest';
import { filterReviewableUsers, getSubmitSuccessMessage } from './approval';

describe('approval constants', () => {
  it('uses Admin message for managers', () => {
    expect(getSubmitSuccessMessage('Manager')).toContain('Admin');
  });

  it('admin team list includes managers', () => {
    const users = [
      { id: 1, role: 'Admin', manager_id: null },
      { id: 2, role: 'Manager', manager_id: 1 },
      { id: 3, role: 'Employee', manager_id: 2 },
    ];
    const list = filterReviewableUsers(users, users[0]);
    expect(list.map((u) => u.role).sort()).toEqual(['Employee', 'Manager']);
  });
});
