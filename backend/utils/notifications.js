import { deepLink } from './appUrl.js';

/** In-app notification + optional Teams webhook / console email stub. */
export const notifyUser = async (pool, { userId, type, title, body, path = '/' }) => {
  const link = deepLink(path);
  const result = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, deep_link)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, type, title, body, link]
  );

  const userRes = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
  const user = userRes.rows[0];
  if (user) {
    await dispatchExternal({ email: user.email, name: user.name, title, body, link });
  }

  return result.rows[0];
};

export const dispatchExternal = async ({ email, name, title, body, link }) => {
  const payload = { email, name, title, body, link };

  if (process.env.SMTP_LOG === 'true' || !process.env.TEAMS_WEBHOOK_URL) {
    console.log('[notification:email-stub]', JSON.stringify(payload));
  }

  const webhook = process.env.TEAMS_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          summary: title,
          themeColor: 'E85D04',
          title,
          text: `${body}\n\n[Open goal portal](${link})`,
          potentialAction: [
            {
              '@type': 'OpenUri',
              name: 'Open Goal Portal',
              targets: [{ os: 'default', uri: link }],
            },
          ],
        }),
      });
    } catch (err) {
      console.error('[notification:teams]', err.message);
    }
  }
};

export const notifyManagerOfSubmit = async (pool, employeeId, employeeName) => {
  const emp = await pool.query(
    'SELECT manager_id, role FROM users WHERE id = $1',
    [employeeId]
  );
  const row = emp.rows[0];
  if (!row) return;

  let managerId = row.manager_id;
  if (row.role === 'Manager') {
    const admin = await pool.query(
      "SELECT id FROM users WHERE role = 'Admin' ORDER BY id LIMIT 1"
    );
    managerId = admin.rows[0]?.id;
  }
  if (!managerId) return;

  await notifyUser(pool, {
    userId: managerId,
    type: 'GOAL_SUBMITTED',
    title: 'Goal sheet submitted',
    body: `${employeeName} submitted a goal sheet for your review.`,
    path: '/?tab=Manager',
  });
};

export const notifyEmployeeOfReview = async (pool, employeeId, action, reviewerName) => {
  const title = action === 'APPROVE' ? 'Goal sheet approved' : 'Goal sheet returned';
  const body =
    action === 'APPROVE'
      ? `${reviewerName} approved your goal sheet.`
      : `${reviewerName} returned your goal sheet for rework.`;

  await notifyUser(pool, {
    userId: employeeId,
    type: action === 'APPROVE' ? 'GOAL_APPROVED' : 'GOAL_REWORK',
    title,
    body,
    path: '/?tab=Employee',
  });
};
