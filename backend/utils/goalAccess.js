import { canReviewGoalSheet } from './approvalWorkflow.js';

/** Read access to a goal (and its check-ins). */
export const canAccessGoal = (requester, goal, goalOwner) => {
  if (!goal || !goalOwner) return false;
  if (requester.role === 'Admin' || goal.user_id === requester.id) return true;
  if (requester.role === 'Manager') {
    return canReviewGoalSheet(requester, goalOwner);
  }
  return false;
};

export const fetchGoalWithOwner = async (pool, goalId) => {
  const result = await pool.query(
    `SELECT g.*, u.id AS owner_id, u.role AS owner_role, u.manager_id AS owner_manager_id,
            u.goal_sheet_status
     FROM goals g
     JOIN users u ON g.user_id = u.id
     WHERE g.id = $1`,
    [goalId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    goal: row,
    owner: {
      id: row.owner_id,
      role: row.owner_role,
      manager_id: row.owner_manager_id,
      goal_sheet_status: row.goal_sheet_status,
    },
  };
};
