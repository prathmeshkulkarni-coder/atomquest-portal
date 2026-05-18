import pool from '../config/db.js';
import { buildCycleStatus } from '../utils/cycleWindows.js';
import { getCycleConfig, invalidateCycleCache, resolveCycleOptions } from '../utils/cycleConfig.js';

export const getCycleStatus = async (req, res) => {
  try {
    const options = await resolveCycleOptions(req.user);
    const status = buildCycleStatus(new Date(), options);
    res.json(status);
  } catch (error) {
    console.error('Get cycle status error:', error);
    res.status(500).json({ message: 'Could not load cycle schedule' });
  }
};

export const updateCycleSettings = async (req, res) => {
  const { enforcement_enabled, demo_mode } = req.body;

  try {
    await pool.query(
      `UPDATE cycle_settings
       SET enforcement_enabled = COALESCE($1, enforcement_enabled),
           demo_mode = COALESCE($2, demo_mode),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT id FROM cycle_settings ORDER BY id LIMIT 1)`,
      [
        enforcement_enabled !== undefined ? enforcement_enabled : null,
        demo_mode !== undefined ? demo_mode : null,
      ]
    );
    invalidateCycleCache();
    const options = await resolveCycleOptions(req.user);
    res.json({
      message: 'Cycle settings updated',
      status: buildCycleStatus(new Date(), options),
    });
  } catch (error) {
    console.error('Update cycle settings error:', error);
    res.status(500).json({ message: 'Could not update cycle settings' });
  }
};

export const getCycleSettings = async (req, res) => {
  try {
    const config = await getCycleConfig();
    const options = await resolveCycleOptions(req.user);
    res.json({
      ...config,
      status: buildCycleStatus(new Date(), options),
    });
  } catch (error) {
    console.error('Get cycle settings error:', error);
    res.status(500).json({ message: 'Could not load cycle settings' });
  }
};
