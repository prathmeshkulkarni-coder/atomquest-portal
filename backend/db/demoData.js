import bcrypt from 'bcryptjs';

/** Insert hackathon demo users only when the DB has no users (safe on every deploy). */
export const seedDemoIfEmpty = async (pool) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n > 0) {
    return { seeded: false, reason: 'users_exist' };
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  const adminRes = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Sarah Admin', 'admin@atomquest.com', $1, 'Admin')
     RETURNING id;`,
    [passwordHash]
  );
  const adminId = adminRes.rows[0].id;

  const managerRes = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, manager_id)
     VALUES ('John Manager', 'manager@atomquest.com', $1, 'Manager', $2)
     RETURNING id;`,
    [passwordHash, adminId]
  );
  const managerId = managerRes.rows[0].id;

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, manager_id)
     VALUES ('Jane Employee', 'employee@atomquest.com', $1, 'Employee', $2);`,
    [passwordHash, managerId]
  );

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, manager_id)
     VALUES ('Alex Developer', 'alex@atomquest.com', $1, 'Employee', $2);`,
    [passwordHash, managerId]
  );

  console.log(`Demo users seeded (password: password123):
    admin@atomquest.com, manager@atomquest.com,
    employee@atomquest.com, alex@atomquest.com`);

  return { seeded: true };
};
