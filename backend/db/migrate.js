/**
 * Idempotent schema updates — safe on every server start (no data wipe).
 * Full reset + demo data: npm run seed
 */

/** Fresh Postgres (Render / prod Docker) — create base tables before ALTERs. */
const ensureBaseSchema = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) CHECK (role IN ('Employee', 'Manager', 'Admin')) NOT NULL,
      manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      goal_sheet_status VARCHAR(20) DEFAULT 'draft'
        CHECK (goal_sheet_status IN ('draft', 'submitted', 'approved'))
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      thrust_area VARCHAR(100) NOT NULL,
      title VARCHAR(150) NOT NULL,
      description TEXT,
      uom VARCHAR(20) CHECK (uom IN ('Numeric', '%', 'Timeline', 'Zero-based')) NOT NULL,
      uom_direction VARCHAR(3) CHECK (uom_direction IN ('Min', 'Max') OR uom_direction IS NULL),
      target VARCHAR(100) NOT NULL,
      weightage NUMERIC(5, 2) NOT NULL,
      is_shared BOOLEAN DEFAULT FALSE,
      parent_goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
      is_locked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkins (
      id SERIAL PRIMARY KEY,
      goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
      quarter VARCHAR(10) CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4', 'Annual')) NOT NULL,
      actual_achievement VARCHAR(100) DEFAULT NULL,
      status VARCHAR(20) CHECK (status IN ('Not Started', 'On Track', 'Completed')) DEFAULT 'Not Started',
      progress_score NUMERIC(5, 2) DEFAULT 0.00,
      manager_comment TEXT DEFAULT NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_goal_quarter UNIQUE (goal_id, quarter)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
      action VARCHAR(50) NOT NULL,
      old_value TEXT DEFAULT NULL,
      new_value TEXT DEFAULT NULL,
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const runMigrations = async (pool) => {
  await ensureBaseSchema(pool);

  await pool.query(`
    ALTER TABLE goals
    ADD COLUMN IF NOT EXISTS uom_direction VARCHAR(3)
    CHECK (uom_direction IN ('Min', 'Max') OR uom_direction IS NULL);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cycle_settings (
      id SERIAL PRIMARY KEY,
      enforcement_enabled BOOLEAN DEFAULT TRUE,
      demo_mode BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const existing = await pool.query('SELECT id FROM cycle_settings LIMIT 1');
  if (existing.rows.length === 0) {
    await pool.query(
      `INSERT INTO cycle_settings (enforcement_enabled, demo_mode) VALUES (TRUE, FALSE);`
    );
  }

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS goal_sheet_status VARCHAR(20) DEFAULT 'draft'
    CHECK (goal_sheet_status IN ('draft', 'submitted', 'approved'));
  `);

  // Backfill: approved if audit shows manager approval
  await pool.query(`
    UPDATE users u SET goal_sheet_status = 'approved'
    WHERE goal_sheet_status = 'draft'
      AND EXISTS (
        SELECT 1 FROM audit_logs a
        JOIN goals g ON g.id = a.goal_id
        WHERE g.user_id = u.id AND a.action = 'MANAGER_APPROVED'
      );
  `);

  await pool.query(`
    UPDATE users u SET goal_sheet_status = 'submitted'
    WHERE goal_sheet_status = 'draft'
      AND u.role IN ('Employee', 'Manager')
      AND EXISTS (SELECT 1 FROM goals g WHERE g.user_id = u.id AND g.is_locked = TRUE);
  `);

  // HR Admin personal sheets do not go through manager approval
  await pool.query(`
    UPDATE users SET goal_sheet_status = 'approved'
    WHERE role = 'Admin' AND goal_sheet_status = 'submitted';
  `);

  // Managers report to Admin for goal-sheet approval (L2)
  await pool.query(`
    UPDATE users m
    SET manager_id = (
      SELECT id FROM users WHERE role = 'Admin' ORDER BY id LIMIT 1
    )
    WHERE m.role = 'Manager'
      AND m.manager_id IS NULL
      AND EXISTS (SELECT 1 FROM users WHERE role = 'Admin');
  `);
};
