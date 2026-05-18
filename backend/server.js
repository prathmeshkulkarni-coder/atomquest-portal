import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './config/db.js';
import { runMigrations } from './db/migrate.js';
import { seedDemoIfEmpty } from './db/demoData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import Controller functions
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
import {
  getCompletionRates,
  getGoalDistribution,
  exportAchievementCSV,
  getQoQTrends,
  getManagerEffectiveness,
} from './controllers/analyticsController.js';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getIntegrationStatus,
} from './controllers/notificationController.js';
import {
  getEscalationRules,
  updateEscalationRules,
  getEscalationLogs,
  runEscalations,
} from './controllers/escalationController.js';
import { login, getProfile, getHierarchy, getSsoConfig, ssoDemoLogin } from './controllers/authController.js';
import { runEscalationChecks } from './utils/escalation.js';
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
app.get('/api/auth/sso/config', getSsoConfig);
app.post('/api/auth/sso/demo', ssoDemoLogin);
app.get('/api/auth/profile', authenticateToken, getProfile);
app.get('/api/auth/hierarchy', authenticateToken, getHierarchy);

app.get('/api/notifications', authenticateToken, getNotifications);
app.patch('/api/notifications/:id/read', authenticateToken, markNotificationRead);
app.post('/api/notifications/read-all', authenticateToken, markAllNotificationsRead);

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
app.get('/api/analytics/qoq', authenticateToken, requireRole(['Admin']), getQoQTrends);
app.get('/api/analytics/manager-effectiveness', authenticateToken, requireRole(['Admin']), getManagerEffectiveness);
app.get('/api/analytics/export', authenticateToken, requireRole(['Admin']), exportAchievementCSV);
app.get('/api/integrations/status', authenticateToken, requireRole(['Admin']), getIntegrationStatus);

app.get('/api/escalations/rules', authenticateToken, requireRole(['Admin']), getEscalationRules);
app.put('/api/escalations/rules', authenticateToken, requireRole(['Admin']), updateEscalationRules);
app.get('/api/escalations/logs', authenticateToken, requireRole(['Admin']), getEscalationLogs);
app.post('/api/escalations/run', authenticateToken, requireRole(['Admin']), runEscalations);

// Production: serve built React app from ./public (same origin as /api)
if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Start Server (migrations + demo users on empty DB — no Render Shell required)
runMigrations(pool)
  .then(() => seedDemoIfEmpty(pool))
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`AtomQuest backend server running on http://0.0.0.0:${PORT}`);
    });
    if (process.env.ESCALATION_ON_STARTUP === 'true') {
      runEscalationChecks(pool).catch((err) => console.error('Startup escalation:', err));
    }
  })
  .catch((err) => {
    console.error('Database migration failed:', err);
    process.exit(1);
  });
