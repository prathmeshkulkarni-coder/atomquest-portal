import pool from '../config/db.js';
import {
  isWeightageTotalValid,
  isIndividualWeightageValid,
  canAddGoal,
  resolveSheetUserId,
} from '../utils/goalValidation.js';
import { assertGoalSettingWindow } from '../utils/cycleWindows.js';
import { resolveCycleOptions } from '../utils/cycleConfig.js';
import { assertGoalSettingForRole } from '../utils/cycleGuards.js';
import { normalizeUomDirection } from '../utils/uom.js';
import { getSubmitSuccessMessage, canReviewGoalSheet } from '../utils/approvalWorkflow.js';
import { notifyManagerOfSubmit, notifyEmployeeOfReview } from '../utils/notifications.js';

// Helper to log audit changes
const logAudit = async (client, goalId, action, oldValue, newValue, userId) => {
  await client.query(
    `INSERT INTO audit_logs (goal_id, action, old_value, new_value, changed_by) 
     VALUES ($1, $2, $3, $4, $5)`,
    [goalId, action, oldValue, newValue, userId]
  );
};

export const getGoals = async (req, res) => {
  const { userId } = req.query;
  const targetUserId = parseInt(userId ?? req.user.id, 10);

  if (Number.isNaN(targetUserId)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  try {
    if (req.user.role !== 'Admin' && targetUserId !== req.user.id) {
      const userRes = await pool.query('SELECT manager_id, role FROM users WHERE id = $1', [targetUserId]);
      const subject = userRes.rows[0];
      if (!subject || !canReviewGoalSheet(req.user, subject)) {
        return res.status(403).json({ message: 'Access Denied: You cannot view this goal sheet' });
      }
    }

    const userRes = await pool.query(
      'SELECT goal_sheet_status FROM users WHERE id = $1',
      [targetUserId]
    );
    const sheetStatus = userRes.rows[0]?.goal_sheet_status || 'draft';

    const result = await pool.query(
      `SELECT g.*, u.name as user_name, u.email as user_email
       FROM goals g
       JOIN users u ON g.user_id = u.id
       WHERE g.user_id = $1
       ORDER BY g.id`,
      [targetUserId]
    );

    res.json({ goals: result.rows, sheetStatus });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const createGoal = async (req, res) => {
  const {
    thrust_area,
    title,
    description,
    uom,
    uom_direction,
    target,
    weightage,
    is_shared,
    parent_goal_id,
    userId: requestedUserId,
  } = req.body;

  if (!thrust_area || !title || !uom || target === undefined || weightage === undefined) {
    return res.status(400).json({ message: 'Thrust Area, Title, UoM, Target, and Weightage are required' });
  }

  const auth = resolveSheetUserId(req.user, requestedUserId);
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const cycleOpts = await resolveCycleOptions(req.user);
  const cycleCheck = assertGoalSettingForRole(
    assertGoalSettingWindow(new Date(), cycleOpts),
    req.user.role
  );
  if (!cycleCheck.allowed) {
    return res.status(403).json({ message: cycleCheck.message });
  }

  const targetUserId = auth.userId;
  const direction = normalizeUomDirection(uom, uom_direction);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (auth.requiresManagerCheck) {
      const empRes = await client.query('SELECT manager_id FROM users WHERE id = $1', [targetUserId]);
      if (empRes.rows.length === 0 || empRes.rows[0].manager_id !== req.user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Access Denied: You do not manage this employee' });
      }
    }

    const sheetRes = await client.query(
      'SELECT goal_sheet_status FROM users WHERE id = $1',
      [targetUserId]
    );
    const sheetStatus = sheetRes.rows[0]?.goal_sheet_status || 'draft';
    if (sheetStatus === 'submitted' || sheetStatus === 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'Goal sheet is locked. Return it for rework before adding goals.',
      });
    }

    // 1. Enforce max goal sheet constraints: maximum 8 goals per employee
    const countRes = await client.query('SELECT COUNT(*) FROM goals WHERE user_id = $1', [targetUserId]);
    const currentCount = parseInt(countRes.rows[0].count);
    if (!canAddGoal(currentCount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Validation Failed: Maximum of 8 goals allowed per goal sheet.' });
    }

    if (!isIndividualWeightageValid(weightage)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Validation Failed: Individual goal weightage must be at least 10%.' });
    }

    // Insert goal
    const insertRes = await client.query(
      `INSERT INTO goals (user_id, thrust_area, title, description, uom, uom_direction, target, weightage, is_shared, parent_goal_id, is_locked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)
       RETURNING *`,
      [targetUserId, thrust_area, title, description, uom, direction, target.toString(), weightage, is_shared || false, parent_goal_id || null]
    );
    const newGoal = insertRes.rows[0];

    // Log Audit
    await logAudit(client, newGoal.id, 'GOAL_CREATED', null, JSON.stringify(newGoal), req.user.id);

    await client.query('COMMIT');
    res.status(201).json(newGoal);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create goal error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    client.release();
  }
};

export const updateGoal = async (req, res) => {
  const { id } = req.params;
  const { thrust_area, title, description, uom, uom_direction, target, weightage } = req.body;
  const userId = req.user.id;

  const cycleOpts = await resolveCycleOptions(req.user);
  const cycleCheck = assertGoalSettingForRole(
    assertGoalSettingWindow(new Date(), cycleOpts),
    req.user.role
  );
  if (!cycleCheck.allowed) {
    return res.status(403).json({ message: cycleCheck.message });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch existing goal
    const goalRes = await client.query('SELECT * FROM goals WHERE id = $1', [id]);
    if (goalRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Goal not found' });
    }

    const goal = goalRes.rows[0];

    // Access control
    const isManager = req.user.role === 'Manager';
    const isAdmin = req.user.role === 'Admin';

    if (!isAdmin && goal.user_id !== userId) {
      // Check if user is their manager and is editing inline
      const userRes = await client.query('SELECT manager_id FROM users WHERE id = $1', [goal.user_id]);
      if (userRes.rows.length === 0 || userRes.rows[0].manager_id !== userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Access Denied: You cannot edit this goal' });
      }
    }

    // Locked validation (Only allow manager or admin to edit locked goals)
    if (goal.is_locked && !isManager && !isAdmin) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Validation Failed: Goal is locked and cannot be modified without admin/manager intervention.' });
    }

    // Shared goal validation: recipients can adjust weightage only
    if (goal.is_shared && goal.parent_goal_id !== null && !isAdmin) {
      if (thrust_area !== undefined || title !== undefined || uom !== undefined || target !== undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Validation Failed: Recipients of shared goals can only adjust weightage.' });
      }
    }

    // Validation for weightage if changing
    if (weightage !== undefined && !isIndividualWeightageValid(weightage)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Validation Failed: Individual goal weightage must be at least 10%.' });
    }

    // Build update query dynamically
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (thrust_area !== undefined) { fields.push(`thrust_area = $${paramIndex++}`); values.push(thrust_area); }
    if (title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (uom !== undefined) { fields.push(`uom = $${paramIndex++}`); values.push(uom); }
    if (uom_direction !== undefined || uom !== undefined) {
      const nextUom = uom !== undefined ? uom : goal.uom;
      fields.push(`uom_direction = $${paramIndex++}`);
      values.push(normalizeUomDirection(nextUom, uom_direction ?? goal.uom_direction));
    }
    if (target !== undefined) { fields.push(`target = $${paramIndex++}`); values.push(target.toString()); }
    if (weightage !== undefined) { fields.push(`weightage = $${paramIndex++}`); values.push(weightage); }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    const updateQuery = `
      UPDATE goals 
      SET ${fields.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING *`;

    const updateRes = await client.query(updateQuery, values);
    const updatedGoal = updateRes.rows[0];

    // Log Audit
    await logAudit(client, id, 'GOAL_UPDATED', JSON.stringify(goal), JSON.stringify(updatedGoal), userId);

    await client.query('COMMIT');
    res.json(updatedGoal);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update goal error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    client.release();
  }
};

export const deleteGoal = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const cycleOpts = await resolveCycleOptions(req.user);
  const cycleCheck = assertGoalSettingForRole(
    assertGoalSettingWindow(new Date(), cycleOpts),
    req.user.role
  );
  if (!cycleCheck.allowed) {
    return res.status(403).json({ message: cycleCheck.message });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const goalRes = await client.query('SELECT * FROM goals WHERE id = $1', [id]);
    if (goalRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Goal not found' });
    }

    const goal = goalRes.rows[0];

    if (goal.user_id !== userId && req.user.role !== 'Admin') {
      if (req.user.role === 'Manager') {
        const empRes = await client.query('SELECT manager_id FROM users WHERE id = $1', [goal.user_id]);
        if (empRes.rows.length === 0 || empRes.rows[0].manager_id !== userId) {
          await client.query('ROLLBACK');
          return res.status(403).json({ message: 'Access Denied' });
        }
      } else {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Access Denied' });
      }
    }

    if (goal.is_locked && req.user.role !== 'Admin') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'This goal is on a locked sheet. Ask your manager or HR to unlock the sheet before removing goals.',
      });
    }

    // Shared KPI pushed by admin: employees may remove the copy from their sheet while unlocked
    const isSharedClone = goal.is_shared && goal.parent_goal_id !== null;
    if (goal.is_shared && !isSharedClone && goal.user_id === userId && req.user.role !== 'Admin') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'This is a primary shared KPI record and cannot be deleted from here.',
      });
    }

    // Log before delete — audit_logs.goal_id references goals(id)
    await logAudit(client, id, 'GOAL_DELETED', JSON.stringify(goal), null, userId);

    await client.query('DELETE FROM goals WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({
      message: isSharedClone
        ? 'Admin-assigned KPI removed from your goal sheet.'
        : 'Goal deleted successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete goal error:', error);
    res.status(500).json({ message: 'Could not delete goal. Please try again.' });
  } finally {
    client.release();
  }
};

export const submitGoalSheet = async (req, res) => {
  const auth = resolveSheetUserId(req.user, req.body?.userId);
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const cycleOpts = await resolveCycleOptions(req.user);
  const cycleCheck = assertGoalSettingForRole(
    assertGoalSettingWindow(new Date(), cycleOpts),
    req.user.role
  );
  if (!cycleCheck.allowed) {
    return res.status(403).json({ message: cycleCheck.message });
  }

  const targetUserId = auth.userId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (auth.requiresManagerCheck) {
      const empRes = await client.query('SELECT manager_id FROM users WHERE id = $1', [targetUserId]);
      if (empRes.rows.length === 0 || empRes.rows[0].manager_id !== req.user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Access Denied: You do not manage this employee' });
      }
    }

    const goalsRes = await client.query('SELECT * FROM goals WHERE user_id = $1', [targetUserId]);
    const goals = goalsRes.rows;

    if (goals.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Validation Failed: Cannot submit an empty Goal Sheet.' });
    }

    if (!isWeightageTotalValid(goals)) {
      const totalWeightage = goals.reduce((sum, g) => sum + parseFloat(g.weightage), 0);
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Validation Failed: Total goal sheet weightage must sum exactly to 100%. Current sum: ${totalWeightage}%`,
      });
    }

    const subjectRes = await client.query('SELECT role FROM users WHERE id = $1', [targetUserId]);
    const subjectRole = subjectRes.rows[0]?.role || 'Employee';
    const autoApprove = subjectRole === 'Admin';
    const nextStatus = autoApprove ? 'approved' : 'submitted';

    await client.query('UPDATE goals SET is_locked = TRUE WHERE user_id = $1', [targetUserId]);
    await client.query(`UPDATE users SET goal_sheet_status = $2 WHERE id = $1`, [targetUserId, nextStatus]);

    for (const goal of goals) {
      await logAudit(client, goal.id, 'GOAL_LOCKED_SUBMITTED', 'is_locked: false', 'is_locked: true', req.user.id);
      if (autoApprove) {
        await logAudit(
          client,
          goal.id,
          'HR_AUTO_APPROVED',
          'sheet: submitted',
          'sheet: approved (Admin HR — no manager approval)',
          req.user.id
        );
      }
    }

    await client.query('COMMIT');

    const nameRes = await pool.query('SELECT name FROM users WHERE id = $1', [targetUserId]);
    const employeeName = nameRes.rows[0]?.name || 'Employee';
    if (!autoApprove) {
      notifyManagerOfSubmit(pool, targetUserId, employeeName).catch(console.error);
    }

    res.json({
      message: getSubmitSuccessMessage(subjectRole),
      approver: subjectRole === 'Manager' ? 'Admin' : subjectRole === 'Admin' ? null : 'Manager',
      sheetStatus: nextStatus,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Submit goalsheet error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    client.release();
  }
};

export const managerReview = async (req, res) => {
  const { employeeId, action, goalsUpdates } = req.body; // action: 'APPROVE' or 'REWORK'
  const managerId = req.user.id;

  if (!employeeId || !action) {
    return res.status(400).json({ message: 'Employee ID and Action are required' });
  }

  const cycleOpts = await resolveCycleOptions(req.user);
  const cycleCheck = assertGoalSettingForRole(
    assertGoalSettingWindow(new Date(), cycleOpts),
    req.user.role
  );
  if (!cycleCheck.allowed) {
    return res.status(403).json({ message: cycleCheck.message });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const subjectRes = await client.query('SELECT manager_id, role FROM users WHERE id = $1', [employeeId]);
    const subject = subjectRes.rows[0];
    if (!subject || !canReviewGoalSheet(req.user, subject)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message:
          req.user.role === 'Admin'
            ? 'Access Denied: Cannot review this user'
            : 'Access Denied: You can only review direct-report employees',
      });
    }

    // 1. Process inline edits first if provided
    if (goalsUpdates && Array.isArray(goalsUpdates)) {
      for (const update of goalsUpdates) {
        const { id, target, weightage } = update;
        
        // Fetch current goal state
        const curGoalRes = await client.query('SELECT * FROM goals WHERE id = $1 AND user_id = $2', [id, employeeId]);
        if (curGoalRes.rows.length === 0) continue;
        const curGoal = curGoalRes.rows[0];

        if (weightage !== undefined && !isIndividualWeightageValid(weightage)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: 'Validation Failed: Individual goal weightage must be at least 10%.' });
        }

        const updateRes = await client.query(
          `UPDATE goals 
           SET target = COALESCE($1, target), weightage = COALESCE($2, weightage), updated_at = CURRENT_TIMESTAMP
           WHERE id = $3 
           RETURNING *`,
          [target !== undefined ? target.toString() : null, weightage !== undefined ? weightage : null, id]
        );
        
        const updatedGoal = updateRes.rows[0];

        // Log audit trail
        await logAudit(client, id, 'MANAGER_INLINE_EDIT', JSON.stringify(curGoal), JSON.stringify(updatedGoal), managerId);
      }
    }

    // Fetch goals post-edits to re-validate sum if approving
    const allGoalsRes = await client.query('SELECT * FROM goals WHERE user_id = $1', [employeeId]);
    const allGoals = allGoalsRes.rows;

    if (action === 'APPROVE') {
      if (!isWeightageTotalValid(allGoals)) {
        const totalWeightage = allGoals.reduce((sum, g) => sum + parseFloat(g.weightage), 0);
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Approval Failed: Total goal sheet weightage must sum to 100% before approving. Current sum: ${totalWeightage}%`,
        });
      }

      await client.query('UPDATE goals SET is_locked = TRUE WHERE user_id = $1', [employeeId]);
      await client.query(
        `UPDATE users SET goal_sheet_status = 'approved' WHERE id = $1`,
        [employeeId]
      );
      for (const goal of allGoals) {
        await logAudit(client, goal.id, 'MANAGER_APPROVED', 'is_locked: false/true', 'is_locked: true (locked)', managerId);
      }
      await client.query('COMMIT');
      const subjectNameRes = await pool.query('SELECT name FROM users WHERE id = $1', [employeeId]);
      const subjectName = subjectNameRes.rows[0]?.name || 'Goal sheet';
      const reviewerRes = await pool.query('SELECT name FROM users WHERE id = $1', [managerId]);
      notifyEmployeeOfReview(pool, employeeId, 'APPROVE', reviewerRes.rows[0]?.name || 'Manager').catch(
        console.error
      );
      return res.json({
        message: `${subjectName}'s goal sheet was approved and locked.`,
        sheetStatus: 'approved',
      });
    }

    if (action === 'REWORK') {
      await client.query('UPDATE goals SET is_locked = FALSE WHERE user_id = $1', [employeeId]);
      await client.query(
        `UPDATE users SET goal_sheet_status = 'draft' WHERE id = $1`,
        [employeeId]
      );
      for (const goal of allGoals) {
        await logAudit(client, goal.id, 'MANAGER_RETURNED_REWORK', 'is_locked: true', 'is_locked: false (unlocked)', managerId);
      }
      await client.query('COMMIT');
      const subjectNameRes = await pool.query('SELECT name FROM users WHERE id = $1', [employeeId]);
      const subjectName = subjectNameRes.rows[0]?.name || 'Goal sheet';
      const reviewerRes = await pool.query('SELECT name FROM users WHERE id = $1', [managerId]);
      notifyEmployeeOfReview(pool, employeeId, 'REWORK', reviewerRes.rows[0]?.name || 'Manager').catch(
        console.error
      );
      return res.json({
        message: `${subjectName}'s sheet was returned for rework (unlocked).`,
        sheetStatus: 'draft',
      });
    }

    await client.query('ROLLBACK');
    return res.status(400).json({ message: 'Invalid action. Use APPROVE or REWORK.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Manager review error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    client.release();
  }
};

export const createSharedGoal = async (req, res) => {
  const { thrust_area, title, description, uom, uom_direction, target, weightage, recipientIds } = req.body;
  const adminId = req.user.id;

  if (!thrust_area || !title || !uom || target === undefined || weightage === undefined || !recipientIds || !Array.isArray(recipientIds)) {
    return res.status(400).json({ message: 'Invalid payload: thrust_area, title, uom, target, weightage, and recipientIds (array) are required' });
  }

  if (!isIndividualWeightageValid(weightage)) {
    return res.status(400).json({ message: 'Validation Failed: Individual goal weightage must be at least 10%.' });
  }

  const cycleOpts = await resolveCycleOptions(req.user);
  const cycleCheck = assertGoalSettingForRole(
    assertGoalSettingWindow(new Date(), cycleOpts),
    req.user.role
  );
  if (!cycleCheck.allowed) {
    return res.status(403).json({ message: cycleCheck.message });
  }

  const direction = normalizeUomDirection(uom, uom_direction);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const parentRes = await client.query(
      `INSERT INTO goals (user_id, thrust_area, title, description, uom, uom_direction, target, weightage, is_shared, parent_goal_id, is_locked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NULL, TRUE)
       RETURNING id`,
      [adminId, thrust_area, title, description, uom, direction, target.toString(), weightage]
    );
    const parentGoalId = parentRes.rows[0].id;

    const clonedGoals = [];
    const skipped = [];

    for (const recipientId of recipientIds) {
      const recipientRes = await client.query(
        'SELECT id, role, manager_id, goal_sheet_status FROM users WHERE id = $1',
        [recipientId]
      );
      const recipient = recipientRes.rows[0];
      if (!recipient) {
        skipped.push({ recipientId, reason: 'User not found' });
        continue;
      }

      const subject = { id: recipient.id, role: recipient.role, manager_id: recipient.manager_id };
      if (req.user.role === 'Manager' && !canReviewGoalSheet(req.user, subject)) {
        skipped.push({ recipientId, reason: 'Not your direct report' });
        continue;
      }
      if (req.user.role === 'Manager' && recipient.role !== 'Employee') {
        skipped.push({ recipientId, reason: 'Managers can only push KPIs to employees' });
        continue;
      }

      if (recipient.goal_sheet_status === 'submitted' || recipient.goal_sheet_status === 'approved') {
        skipped.push({ recipientId, reason: 'Goal sheet is locked (submitted or approved)' });
        continue;
      }

      const countRes = await client.query('SELECT COUNT(*) FROM goals WHERE user_id = $1', [recipientId]);
      if (!canAddGoal(parseInt(countRes.rows[0].count))) {
        skipped.push({ recipientId, reason: 'Maximum 8 goals reached' });
        continue;
      }

      const cloneRes = await client.query(
        `INSERT INTO goals (user_id, thrust_area, title, description, uom, uom_direction, target, weightage, is_shared, parent_goal_id, is_locked)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, FALSE)
         RETURNING *`,
        [recipientId, thrust_area, title, description, uom, direction, target.toString(), weightage, parentGoalId]
      );
      clonedGoals.push(cloneRes.rows[0]);
      
      // Log Audit
      await logAudit(client, cloneRes.rows[0].id, 'SHARED_GOAL_PUSHED', null, JSON.stringify(cloneRes.rows[0]), adminId);
    }

    if (clonedGoals.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'No KPIs were assigned. All recipients were skipped.',
        skipped,
      });
    }

    await client.query('COMMIT');
    res.status(201).json({
      parentGoalId,
      clonedCount: clonedGoals.length,
      clonedGoals,
      skipped: skipped.length ? skipped : undefined,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Shared goal error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    client.release();
  }
};

export const adminUnlockGoalSheet = async (req, res) => {
  const { employeeId } = req.body;

  if (!employeeId) {
    return res.status(400).json({ message: 'Employee ID is required' });
  }

  try {
    const goalsRes = await pool.query('SELECT * FROM goals WHERE user_id = $1', [employeeId]);
    if (goalsRes.rows.length === 0) {
      return res.status(404).json({ message: 'No goals found for this employee' });
    }

    await pool.query('UPDATE goals SET is_locked = FALSE WHERE user_id = $1', [employeeId]);
    await pool.query(`UPDATE users SET goal_sheet_status = 'draft' WHERE id = $1`, [employeeId]);

    // Log audit logs
    for (const goal of goalsRes.rows) {
      await pool.query(
        `INSERT INTO audit_logs (goal_id, action, old_value, new_value, changed_by) 
         VALUES ($1, 'ADMIN_UNLOCKED', 'is_locked: true', 'is_locked: false', $2)`,
        [goal.id, req.user.id]
      );
    }

    res.json({ message: 'Goal Sheet unlocked successfully (editable now)' });
  } catch (error) {
    console.error('Admin unlock error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, g.title as goal_title, u.name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN goals g ON a.goal_id = g.id
       LEFT JOIN users u ON a.changed_by = u.id
       ORDER BY a.changed_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
