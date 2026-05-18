import pool from '../config/db.js';

export const getCompletionRates = async (req, res) => {
  try {
    // 1. Staff with goal sheets (employees + managers; excludes admin-only records)
    const totalEmpRes = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role IN ('Employee', 'Manager')"
    );
    const totalEmployees = parseInt(totalEmpRes.rows[0].count);

    // 2. Locked goal sheets among staff (exclude shared-KPI parent rows on admin/manager)
    const lockedEmpRes = await pool.query(`
      SELECT COUNT(DISTINCT g.user_id)
      FROM goals g
      JOIN users u ON u.id = g.user_id
      WHERE g.is_locked = TRUE
        AND u.role IN ('Employee', 'Manager')
        AND NOT (g.is_shared = TRUE AND g.parent_goal_id IS NULL)
    `);
    const lockedGoalSheets = parseInt(lockedEmpRes.rows[0].count);

    // 3. Check-in completions by quarter
    const checkinStatsRes = await pool.query(`
      SELECT 
        c.quarter,
        COUNT(DISTINCT g.user_id) as employees_completed,
        COUNT(c.id) as total_checkins,
        ROUND(AVG(c.progress_score), 2) as average_score
      FROM checkins c
      JOIN goals g ON c.goal_id = g.id
      GROUP BY c.quarter
      ORDER BY c.quarter
    `);

    // 4. Seeding managers and their completion rates
    const managerStatsRes = await pool.query(`
      SELECT 
        m.name as manager_name,
        COUNT(DISTINCT u.id) as total_reporters,
        COUNT(DISTINCT CASE WHEN u.goal_sheet_status = 'approved' THEN u.id END) as approved_reporters
      FROM users m
      JOIN users u ON u.manager_id = m.id
      LEFT JOIN goals g ON g.user_id = u.id
      WHERE m.role = 'Manager'
      GROUP BY m.name
    `);

    res.json({
      totalEmployees,
      lockedGoalSheets,
      phase1CompletionRate: totalEmployees > 0 ? parseFloat(((lockedGoalSheets / totalEmployees) * 100).toFixed(2)) : 0,
      quarterlyStats: checkinStatsRes.rows,
      managerStats: managerStatsRes.rows
    });
  } catch (error) {
    console.error('Get completion rates error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getGoalDistribution = async (req, res) => {
  try {
    // 1. Distribution by Thrust Area
    const thrustRes = await pool.query(`
      SELECT thrust_area, COUNT(*) as count
      FROM goals
      GROUP BY thrust_area
      ORDER BY count DESC
    `);

    // 2. Distribution by UoM
    const uomRes = await pool.query(`
      SELECT uom, COUNT(*) as count
      FROM goals
      GROUP BY uom
      ORDER BY count DESC
    `);

    // 3. Distribution by Check-in Status (Current status per quarter)
    const statusRes = await pool.query(`
      SELECT quarter, status, COUNT(*) as count
      FROM checkins
      GROUP BY quarter, status
      ORDER BY quarter, count DESC
    `);

    res.json({
      thrustArea: thrustRes.rows,
      uom: uomRes.rows,
      status: statusRes.rows
    });
  } catch (error) {
    console.error('Goal distribution error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const exportAchievementCSV = async (req, res) => {
  try {
    // Fetch all goals and join with user details and checkins
    const query = `
      SELECT 
        u.name as employee_name,
        u.email as employee_email,
        u.role as user_role,
        g.thrust_area,
        g.title as goal_title,
        g.uom,
        g.target as planned_target,
        g.weightage,
        c.quarter,
        c.actual_achievement,
        c.status as checkin_status,
        c.progress_score,
        c.manager_comment
      FROM goals g
      JOIN users u ON g.user_id = u.id
      LEFT JOIN checkins c ON c.goal_id = g.id
      WHERE u.role IN ('Employee', 'Manager')
        AND NOT (g.is_shared = TRUE AND g.parent_goal_id IS NULL)
      ORDER BY u.role, u.name, g.id, c.quarter
    `;

    const result = await pool.query(query);
    const rows = result.rows;

    // Build massive unified table lines
    let csvContent =
      'Name,Email,Role,Thrust Area,Goal Title,UoM,Planned Target,Weightage,Quarter,Actual Achievement,Status,Progress Score,Reviewer Comment\n';

    for (const row of rows) {
      // Escape commas and double quotes for safety
      const escape = (val) => {
        if (val === null || val === undefined) return '';
        const str = val.toString();
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      csvContent += `${escape(row.employee_name)},${escape(row.employee_email)},${escape(row.user_role)},${escape(row.thrust_area)},${escape(row.goal_title)},${escape(row.uom)},${escape(row.planned_target)},${row.weightage},${escape(row.quarter)},${escape(row.actual_achievement)},${escape(row.checkin_status)},${row.progress_score || 0},${escape(row.manager_comment)}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=Goal_Achievement_Report.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
