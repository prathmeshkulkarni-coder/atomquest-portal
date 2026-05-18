import pool from '../config/db.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import { assertCheckinWindow } from '../utils/cycleWindows.js';
import { resolveCycleOptions } from '../utils/cycleConfig.js';
import { canAccessGoal, fetchGoalWithOwner } from '../utils/goalAccess.js';
import { canReviewGoalSheet } from '../utils/approvalWorkflow.js';

export { calculateScore };

export const getCheckins = async (req, res) => {
  const { goalId } = req.params;

  try {
    const access = await fetchGoalWithOwner(pool, goalId);
    if (!access) {
      return res.status(404).json({ message: 'Goal not found' });
    }
    if (!canAccessGoal(req.user, access.goal, access.owner)) {
      return res.status(403).json({ message: 'Access Denied: You cannot view check-ins for this goal' });
    }

    const result = await pool.query(
      `SELECT c.*, u.name as updater_name
       FROM checkins c
       LEFT JOIN users u ON c.updated_by = u.id
       WHERE c.goal_id = $1
       ORDER BY c.quarter`,
      [goalId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get checkins error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const logCheckin = async (req, res) => {
  const { goalId, quarter, actual_achievement, status } = req.body;
  const userId = req.user.id;

  if (!goalId || !quarter || !status) {
    return res.status(400).json({ message: 'Goal ID, Quarter, and Status are required' });
  }

  if (
    actual_achievement === undefined ||
    actual_achievement === null ||
    String(actual_achievement).trim() === ''
  ) {
    return res.status(400).json({ message: 'Actual achievement is required to save a check-in.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const goalRes = await client.query('SELECT * FROM goals WHERE id = $1', [goalId]);
    if (goalRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Goal not found' });
    }
    const goal = goalRes.rows[0];

    const ownerRes = await client.query(
      'SELECT id, role, manager_id, goal_sheet_status FROM users WHERE id = $1',
      [goal.user_id]
    );
    const owner = ownerRes.rows[0];

    if (!canAccessGoal(req.user, goal, owner)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Access Denied: You cannot update check-ins for this goal' });
    }

    if (goal.user_id !== userId && req.user.role !== 'Admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Access Denied: Only the goal owner can log achievements' });
    }

    const cycleOpts = await resolveCycleOptions(req.user);
    const cycleCheck = assertCheckinWindow(quarter, new Date(), cycleOpts);
    if (!cycleCheck.allowed) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: cycleCheck.message });
    }

    const actualStr = String(actual_achievement).trim();
    const score = calculateScore(goal.uom, goal.target, actualStr, goal.uom_direction || 'Min');

    const checkinRes = await client.query(
      `INSERT INTO checkins (goal_id, quarter, actual_achievement, status, progress_score, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (goal_id, quarter) 
       DO UPDATE SET 
         actual_achievement = EXCLUDED.actual_achievement,
         status = EXCLUDED.status,
         progress_score = EXCLUDED.progress_score,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [goalId, quarter, actualStr, status, score, userId]
    );
    const checkin = checkinRes.rows[0];

    await client.query(
      `INSERT INTO audit_logs (goal_id, action, old_value, new_value, changed_by)
       VALUES ($1, 'ACHIEVEMENT_UPDATED', $2, $3, $4)`,
      [goalId, `Quarter: ${quarter}`, `Actual: ${actualStr}, Score: ${score}%, Status: ${status}`, userId]
    );

    if (goal.is_shared && goal.parent_goal_id === null) {
      const clonesRes = await client.query('SELECT id, user_id FROM goals WHERE parent_goal_id = $1', [goal.id]);
      for (const clone of clonesRes.rows) {
        await client.query(
          `INSERT INTO checkins (goal_id, quarter, actual_achievement, status, progress_score, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (goal_id, quarter) 
           DO UPDATE SET 
             actual_achievement = EXCLUDED.actual_achievement,
             status = EXCLUDED.status,
             progress_score = EXCLUDED.progress_score,
             updated_by = EXCLUDED.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
          [clone.id, quarter, actualStr, status, score, userId]
        );
        await client.query(
          `INSERT INTO audit_logs (goal_id, action, old_value, new_value, changed_by)
           VALUES ($1, 'SHARED_ACHIEVEMENT_SYNCED', $2, $3, $4)`,
          [clone.id, `Quarter: ${quarter}`, `Synced Actual: ${actualStr}, Score: ${score}%`, userId]
        );
      }
    }

    await client.query('COMMIT');
    res.json(checkin);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Log checkin error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    client.release();
  }
};

export const managerCheckin = async (req, res) => {
  const { goalId, quarter, manager_comment } = req.body;
  const managerId = req.user.id;

  if (!goalId || !quarter || manager_comment === undefined) {
    return res.status(400).json({ message: 'Goal ID, Quarter, and Manager Comment are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const access = await fetchGoalWithOwner(pool, goalId);
    if (!access) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Goal not found' });
    }

    const { goal, owner } = access;

    if (!canReviewGoalSheet(req.user, owner)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Access Denied: You cannot comment on this goal' });
    }

    const cycleOpts = await resolveCycleOptions(req.user);
    const cycleCheck = assertCheckinWindow(quarter, new Date(), cycleOpts);
    if (!cycleCheck.allowed) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: cycleCheck.message });
    }

    const checkinRes = await client.query(
      `INSERT INTO checkins (goal_id, quarter, status, progress_score, manager_comment, updated_by)
       VALUES ($1, $2, 'Not Started', 0, $3, $4)
       ON CONFLICT (goal_id, quarter) 
       DO UPDATE SET 
         manager_comment = EXCLUDED.manager_comment,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [goalId, quarter, manager_comment, managerId]
    );

    await client.query(
      `INSERT INTO audit_logs (goal_id, action, old_value, new_value, changed_by)
       VALUES ($1, 'MANAGER_CHECKIN_COMMENT', $2, $3, $4)`,
      [goalId, `Quarter: ${quarter}`, `Comment: ${manager_comment}`, managerId]
    );

    await client.query('COMMIT');
    res.json(checkinRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Manager checkin comment error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    client.release();
  }
};
