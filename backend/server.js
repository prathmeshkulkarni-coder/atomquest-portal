import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './config/db.js';
import { runMigrations } from './db/migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import Controller functions
import { login, getProfile, getHierarchy } from './controllers/authController.js';
import { 
  getGoals, 
  createGoal, 
  updateGoal, 
  deleteGoal, 
  submitGoalSheet, 
  managerReview, 
  createSharedGoal, 
  adminUnlockGoalSheet, 
  getAuditLogs 
} from './controllers/goalController.js';
import { getCheckins, logCheckin, managerCheckin } from './controllers/checkinController.js';
import { getCompletionRates, getGoalDistribution, exportAchievementCSV } from './controllers/analyticsController.js';
import { getCycleStatus, getCycleSettings, updateCycleSettings } from './controllers/cycleController.js';

// Import Middlewares
import { authenticateToken, requireRole } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*', // Allow all origins for the hackathon deployment
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// --- Health Check ---
app.get('/api/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT 1');
    if (dbCheck.rows.length > 0) {
      return res.json({ status: 'OK', message: 'Backend server and Database are healthy.' });
    }
  } catch (error) {
    return res.status(500).json({ status: 'ERROR', message: 'Database connection failed.', error: error.message });
  }
});

// --- Authentication Routes ---
app.post('/api/auth/login', login);
app.get('/api/auth/profile', authenticateToken, getProfile);
app.get('/api/auth/hierarchy', authenticateToken, getHierarchy);

// --- Goal Setting & Approval (Phase 1) Routes ---
app.get('/api/goals', authenticateToken, getGoals);
app.post('/api/goals', authenticateToken, createGoal);
app.put('/api/goals/:id', authenticateToken, updateGoal);
app.delete('/api/goals/:id', authenticateToken, deleteGoal);
app.post('/api/goals/submit', authenticateToken, submitGoalSheet);
app.post('/api/goals/review', authenticateToken, requireRole(['Manager', 'Admin']), managerReview);
app.post('/api/goals/shared', authenticateToken, requireRole(['Manager', 'Admin']), createSharedGoal);
app.post('/api/goals/unlock', authenticateToken, requireRole(['Admin']), adminUnlockGoalSheet);
app.get('/api/goals/audit', authenticateToken, requireRole(['Admin']), getAuditLogs);

// --- Achievement & Quarterly Check-ins (Phase 2) Routes ---
app.get('/api/checkins/:goalId', authenticateToken, getCheckins);
app.post('/api/checkins/log', authenticateToken, logCheckin);
app.post('/api/checkins/comment', authenticateToken, requireRole(['Manager', 'Admin']), managerCheckin);

// --- Cycle schedule (BRD §2.3) ---
app.get('/api/cycles/status', authenticateToken, getCycleStatus);
app.get('/api/cycles/settings', authenticateToken, requireRole(['Admin']), getCycleSettings);
app.put('/api/cycles/settings', authenticateToken, requireRole(['Admin']), updateCycleSettings);

// --- Reporting & Governance Routes ---
app.get('/api/analytics/completion', authenticateToken, requireRole(['Admin']), getCompletionRates);
app.get('/api/analytics/distribution', authenticateToken, requireRole(['Admin']), getGoalDistribution);
app.get('/api/analytics/export', authenticateToken, requireRole(['Admin']), exportAchievementCSV);

// Production: serve built React app from ./public (same origin as /api)
if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Start Server (run migrations first so API matches code)
runMigrations(pool)
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`AtomQuest backend server running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database migration failed:', err);
    process.exit(1);
  });
