import pool from '../config/db.js';

let cached = null;
let cachedAt = 0;
const TTL_MS = 5000;

export const getCycleConfig = async () => {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;

  try {
    const result = await pool.query(
      'SELECT enforcement_enabled, demo_mode FROM cycle_settings ORDER BY id LIMIT 1'
    );
    if (result.rows.length === 0) {
      cached = { enforcement_enabled: true, demo_mode: false };
    } else {
      cached = result.rows[0];
    }
  } catch {
    cached = { enforcement_enabled: true, demo_mode: false };
  }
  cachedAt = now;
  return cached;
};

export const invalidateCycleCache = () => {
  cached = null;
  cachedAt = 0;
};

export const resolveCycleOptions = async (user) => {
  const config = await getCycleConfig();
  const bypass =
    user?.role === 'Admin' ||
    config.demo_mode === true ||
    process.env.CYCLE_DEMO_MODE === 'true';

  return {
    enforcementEnabled: config.enforcement_enabled !== false,
    demoMode: config.demo_mode === true,
    bypass,
  };
};
