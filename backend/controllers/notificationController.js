import pool from '../config/db.js';

export const getNotifications = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, type, title, body, deep_link, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const unread = await pool.query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ notifications: result.rows, unreadCount: unread.rows[0].n });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const markNotificationRead = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [
      req.user.id,
    ]);
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getIntegrationStatus = async (req, res) => {
  res.json({
    azureSsoDemo: process.env.AZURE_SSO_DEMO === 'true',
    teamsWebhook: Boolean(process.env.TEAMS_WEBHOOK_URL),
    emailStub: process.env.SMTP_LOG === 'true' || !process.env.SMTP_HOST,
    appUrl: process.env.APP_URL || process.env.CORS_ORIGIN || null,
  });
};
