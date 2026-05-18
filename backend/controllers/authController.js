import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'atomquest_jwt_super_secret_key_2026';

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        manager_id: user.manager_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u1.id, u1.name, u1.email, u1.role, u1.manager_id, u2.name as manager_name 
       FROM users u1 
       LEFT JOIN users u2 ON u1.manager_id = u2.id 
       WHERE u1.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getHierarchy = async (req, res) => {
  try {
    // If Admin, get all users. If Manager, get reporting employees. If Employee, get self and team.
    let query = '';
    let params = [];

    if (req.user.role === 'Admin') {
      query = `
        SELECT u.id, u.name, u.email, u.role, u.manager_id, m.name as manager_name
        FROM users u
        LEFT JOIN users m ON u.manager_id = m.id
        ORDER BY u.role, u.name
      `;
    } else if (req.user.role === 'Manager') {
      query = `
        SELECT u.id, u.name, u.email, u.role, u.manager_id, m.name as manager_name
        FROM users u
        LEFT JOIN users m ON u.manager_id = m.id
        WHERE u.manager_id = $1 OR u.id = $1
        ORDER BY u.role, u.name
      `;
      params = [req.user.id];
    } else {
      query = `
        SELECT u.id, u.name, u.email, u.role, u.manager_id, m.name as manager_name
        FROM users u
        LEFT JOIN users m ON u.manager_id = m.id
        WHERE u.id = $1 OR u.manager_id = (SELECT manager_id FROM users WHERE id = $1)
        ORDER BY u.role, u.name
      `;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get hierarchy error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
