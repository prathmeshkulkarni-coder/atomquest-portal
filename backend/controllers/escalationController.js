import pool from '../config/db.js';
import { runEscalationChecks } from '../utils/escalation.js';

export const getEscalationRules = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, rule_type, days_threshold, enabled FROM escalation_rules ORDER BY id'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateEscalationRules = async (req, res) => {
  const { rules } = req.body;
  if (!Array.isArray(rules)) {
    return res.status(400).json({ message: 'rules array required' });
  }
  try {
    for (const r of rules) {
      await pool.query(
        `UPDATE escalation_rules SET days_threshold = $2, enabled = $3, updated_at = CURRENT_TIMESTAMP
         WHERE rule_type = $1`,
        [r.rule_type, r.days_threshold, r.enabled !== false]
      );
    }
    const result = await pool.query(
      'SELECT id, rule_type, days_threshold, enabled FROM escalation_rules ORDER BY id'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getEscalationLogs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, s.name AS subject_name, t.name AS escalated_to_name
      FROM escalation_logs e
      LEFT JOIN users s ON s.id = e.subject_user_id
      LEFT JOIN users t ON t.id = e.escalated_to_user_id
      ORDER BY e.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const runEscalations = async (req, res) => {
  try {
    const demo = req.query.demo === 'true' || req.body?.demo === true;
    const result = await runEscalationChecks(pool, { demo });
    res.json({
      message: demo
        ? 'Demo escalation check completed (0-day thresholds).'
        : 'Escalation check completed.',
      ...result,
    });
  } catch (error) {
    console.error('Run escalations error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
