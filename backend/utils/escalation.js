import { isGoalSettingOpen, isQuarterCheckinOpen } from './cycleWindows.js';
import { resolveCycleOptions } from './cycleConfig.js';
import { notifyUser } from './notifications.js';

const daysSince = (date) => {
  if (!date) return 999;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
};

export const runEscalationChecks = async (pool, { demo = false } = {}) => {
  const rulesRes = await pool.query(
    'SELECT rule_type, days_threshold, enabled FROM escalation_rules WHERE enabled = TRUE'
  );
  const rules = Object.fromEntries(
    rulesRes.rows.map((r) => [r.rule_type, r.days_threshold])
  );

  const submitDays = demo ? 0 : (rules.GOAL_NOT_SUBMITTED ?? 7);
  const approveDays = demo ? 0 : (rules.MANAGER_NOT_APPROVED ?? 5);
  const checkinDays = demo ? 0 : (rules.CHECKIN_INCOMPLETE ?? 7);

  const cycleOpts = await resolveCycleOptions({ role: 'Admin' });
  const now = new Date();
  const created = [];

  if (isGoalSettingOpen(now, cycleOpts)) {
    const draftRes = await pool.query(`
      SELECT u.id, u.name, u.email, u.manager_id,
             (SELECT MAX(g.updated_at) FROM goals g WHERE g.user_id = u.id) AS last_activity
      FROM users u
      WHERE u.role IN ('Employee', 'Manager')
        AND u.goal_sheet_status = 'draft'
        AND EXISTS (SELECT 1 FROM goals g WHERE g.user_id = u.id)
    `);

    for (const row of draftRes.rows) {
      if (daysSince(row.last_activity) < submitDays) continue;
      const exists = await pool.query(
        `SELECT 1 FROM escalation_logs
         WHERE rule_type = 'GOAL_NOT_SUBMITTED' AND subject_user_id = $1
           AND created_at > NOW() - INTERVAL '7 days'`,
        [row.id]
      );
      if (exists.rows.length) continue;

      await logEscalation(pool, {
        ruleType: 'GOAL_NOT_SUBMITTED',
        subjectUserId: row.id,
        message: `${row.name} has draft goals but has not submitted the sheet (${submitDays}+ days).`,
      });

      await notifyUser(pool, {
        userId: row.id,
        type: 'ESCALATION',
        title: 'Reminder: submit your goal sheet',
        body: 'Your goal sheet is still in draft. Please submit before the goal-setting window closes.',
        path: '/?tab=Employee',
      });

      if (row.manager_id) {
        await notifyUser(pool, {
          userId: row.manager_id,
          type: 'ESCALATION',
          title: 'Escalation: unsubmitted goal sheet',
          body: `${row.name} has not submitted their goal sheet after ${submitDays} days.`,
          path: '/?tab=Manager',
        });
        await logEscalation(pool, {
          ruleType: 'GOAL_NOT_SUBMITTED',
          subjectUserId: row.id,
          escalatedToUserId: row.manager_id,
          message: `Manager notified: ${row.name} not submitted.`,
        });
      }
      created.push('GOAL_NOT_SUBMITTED', row.id);
    }
  }

  const submittedRes = await pool.query(`
    SELECT u.id, u.name, u.manager_id,
           (SELECT MAX(a.changed_at) FROM audit_logs a
            JOIN goals g ON g.id = a.goal_id
            WHERE g.user_id = u.id AND a.action = 'GOAL_LOCKED_SUBMITTED') AS submitted_at
    FROM users u
    WHERE u.role IN ('Employee', 'Manager')
      AND u.goal_sheet_status = 'submitted'
  `);

  for (const row of submittedRes.rows) {
    if (daysSince(row.submitted_at) < approveDays) continue;
    const approverId =
      row.manager_id ||
      (await pool.query("SELECT id FROM users WHERE role = 'Admin' LIMIT 1")).rows[0]?.id;
    if (!approverId) continue;

    const exists = await pool.query(
      `SELECT 1 FROM escalation_logs
       WHERE rule_type = 'MANAGER_NOT_APPROVED' AND subject_user_id = $1
         AND created_at > NOW() - INTERVAL '7 days'`,
      [row.id]
    );
    if (exists.rows.length) continue;

    await logEscalation(pool, {
      ruleType: 'MANAGER_NOT_APPROVED',
      subjectUserId: row.id,
      escalatedToUserId: approverId,
      message: `${row.name}'s sheet awaiting approval for ${approveDays}+ days.`,
    });

    await notifyUser(pool, {
      userId: approverId,
      type: 'ESCALATION',
      title: 'Escalation: pending approval',
      body: `${row.name}'s goal sheet has been waiting for approval for ${approveDays}+ days.`,
      path: '/?tab=Manager',
    });
    created.push('MANAGER_NOT_APPROVED', row.id);
  }

  for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
    if (!isQuarterCheckinOpen(quarter, now, cycleOpts)) continue;

    const missingRes = await pool.query(
      `
      SELECT DISTINCT u.id, u.name, u.manager_id
      FROM users u
      JOIN goals g ON g.user_id = u.id AND g.is_locked = TRUE
      WHERE u.role IN ('Employee', 'Manager')
        AND NOT EXISTS (
          SELECT 1 FROM checkins c
          JOIN goals g2 ON g2.id = c.goal_id
          WHERE g2.user_id = u.id AND c.quarter = $1
            AND c.actual_achievement IS NOT NULL AND TRIM(c.actual_achievement) <> ''
        )
      `,
      [quarter]
    );

    for (const row of missingRes.rows) {
      const exists = await pool.query(
        `SELECT 1 FROM escalation_logs
         WHERE rule_type = 'CHECKIN_INCOMPLETE' AND subject_user_id = $1
           AND metadata->>'quarter' = $2
           AND created_at > NOW() - INTERVAL '14 days'`,
        [row.id, quarter]
      );
      if (exists.rows.length) continue;

      await logEscalation(pool, {
        ruleType: 'CHECKIN_INCOMPLETE',
        subjectUserId: row.id,
        message: `${row.name} has not completed ${quarter} check-in.`,
        metadata: { quarter },
      });

      await notifyUser(pool, {
        userId: row.id,
        type: 'ESCALATION',
        title: `${quarter} check-in reminder`,
        body: `Please log your ${quarter} actuals before the check-in window closes.`,
        path: '/?tab=Employee',
      });

      if (row.manager_id) {
        await notifyUser(pool, {
          userId: row.manager_id,
          type: 'ESCALATION',
          title: `Escalation: ${quarter} check-in missing`,
          body: `${row.name} has not completed the ${quarter} check-in.`,
          path: '/?tab=Manager',
        });
      }
      created.push('CHECKIN_INCOMPLETE', row.id);
    }
  }

  const adminRes = await pool.query("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");
  const adminId = adminRes.rows[0]?.id;
  if (adminId && created.length > 0) {
    await notifyUser(pool, {
      userId: adminId,
      type: 'ESCALATION',
      title: 'Escalation summary',
      body: `${created.length / 2} escalation event(s) were recorded. Review the escalation log in Administration.`,
      path: '/?tab=Admin',
    });
  }

  return { eventsCreated: created.length / 2 };
};

const logEscalation = async (
  pool,
  { ruleType, subjectUserId, escalatedToUserId = null, message, metadata = {} }
) => {
  await pool.query(
    `INSERT INTO escalation_logs (rule_type, subject_user_id, escalated_to_user_id, message, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [ruleType, subjectUserId, escalatedToUserId, message, JSON.stringify(metadata)]
  );
};
