import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

const seedDatabase = async () => {
  try {
    console.log('Starting database schema migration & seeding...');

    // Drop tables if they exist to start clean
    await pool.query(`
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS checkins CASCADE;
      DROP TABLE IF EXISTS goals CASCADE;
      DROP TABLE IF EXISTS cycle_settings CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    console.log('Old tables dropped.');

    // Create users table
    await pool.query(`
      CREATE TABLE users (
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
    console.log('Created "users" table.');

    // Create goals table
    await pool.query(`
      CREATE TABLE goals (
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
    console.log('Created "goals" table.');

    // Create checkins table
    await pool.query(`
      CREATE TABLE checkins (
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
    console.log('Created "checkins" table.');

    // Create audit_logs table
    await pool.query(`
      CREATE TABLE audit_logs (
        id SERIAL PRIMARY KEY,
        goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        old_value TEXT DEFAULT NULL,
        new_value TEXT DEFAULT NULL,
        changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Created "audit_logs" table.');

    await pool.query(`
      CREATE TABLE cycle_settings (
        id SERIAL PRIMARY KEY,
        enforcement_enabled BOOLEAN DEFAULT TRUE,
        demo_mode BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(
      `INSERT INTO cycle_settings (enforcement_enabled, demo_mode) VALUES (TRUE, FALSE);`
    );
    console.log('Created "cycle_settings" table (BRD §2.3).');

    // Seed default users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    // 1. HR/Admin Sarah
    const adminRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ('Sarah Admin', 'admin@atomquest.com', $1, 'Admin') 
       RETURNING id;`,
      [passwordHash]
    );
    const adminId = adminRes.rows[0].id;

    // 2. Manager John (reports to Admin for goal-sheet approval)
    const managerRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, manager_id) 
       VALUES ('John Manager', 'manager@atomquest.com', $1, 'Manager', $2) 
       RETURNING id;`,
      [passwordHash, adminId]
    );
    const managerId = managerRes.rows[0].id;

    // 3. Employees reporting to John
    const emp1Res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, manager_id) 
       VALUES ('Jane Employee', 'employee@atomquest.com', $1, 'Employee', $2) 
       RETURNING id;`,
      [passwordHash, managerId]
    );
    const emp1Id = emp1Res.rows[0].id;

    const emp2Res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, manager_id) 
       VALUES ('Alex Developer', 'alex@atomquest.com', $1, 'Employee', $2) 
       RETURNING id;`,
      [passwordHash, managerId]
    );
    const emp2Id = emp2Res.rows[0].id;

    console.log(`Database seeded successfully!
    - Admin: Sarah Admin (admin@atomquest.com)
    - Manager: John Manager (manager@atomquest.com)
    - Employee 1: Jane Employee (employee@atomquest.com)
    - Employee 2: Alex Developer (alex@atomquest.com)
    - (Password for all: password123)
    `);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
