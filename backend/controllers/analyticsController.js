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

/** QoQ average progress score by quarter (bonus analytics §5.4). */
export const getQoQTrends = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.quarter,
        COUNT(DISTINCT g.user_id) AS employees_with_data,
        ROUND(AVG(c.progress_score)::numeric, 2) AS avg_score,
        ROUND(MAX(c.progress_score)::numeric, 2) AS max_score,
        COUNT(c.id) AS checkin_count
      FROM checkins c
      JOIN goals g ON g.id = c.goal_id
      JOIN users u ON u.id = g.user_id
      WHERE u.role IN ('Employee', 'Manager')
        AND c.progress_score IS NOT NULL
      GROUP BY c.quarter
      ORDER BY CASE c.quarter
        WHEN 'Q1' THEN 1 WHEN 'Q2' THEN 2 WHEN 'Q3' THEN 3 WHEN 'Q4' THEN 4 ELSE 5 END
    `);

    const teamRes = await pool.query(`
      SELECT
        m.name AS manager_name,
        c.quarter,
        ROUND(AVG(c.progress_score)::numeric, 2) AS avg_score
      FROM checkins c
      JOIN goals g ON g.id = c.goal_id
      JOIN users u ON u.id = g.user_id
      JOIN users m ON u.manager_id = m.id
      WHERE u.role = 'Employee' AND c.progress_score IS NOT NULL
      GROUP BY m.name, c.quarter
      ORDER BY m.name, c.quarter
    `);

    res.json({ organization: result.rows, byManager: teamRes.rows });
  } catch (error) {
    console.error('QoQ trends error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/** Manager check-in completion rates (bonus §5.4). */
export const getManagerEffectiveness = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.id AS manager_id,
        m.name AS manager_name,
        COUNT(DISTINCT u.id) AS team_size,
        COUNT(DISTINCT CASE WHEN c.id IS NOT NULL AND c.actual_achievement IS NOT NULL
          AND TRIM(c.actual_achievement) <> '' THEN u.id END) AS employees_with_checkins,
        COUNT(DISTINCT CASE WHEN u.goal_sheet_status = 'approved' THEN u.id END) AS approved_sheets,
        ROUND(
          100.0 * COUNT(DISTINCT CASE WHEN c.manager_comment IS NOT NULL
            AND TRIM(c.manager_comment) <> '' THEN c.id END)
          / NULLIF(COUNT(c.id), 0),
        2) AS comment_rate_pct
      FROM users m
      JOIN users u ON u.manager_id = m.id AND u.role = 'Employee'
      LEFT JOIN goals g ON g.user_id = u.id
      LEFT JOIN checkins c ON c.goal_id = g.id
      WHERE m.role = 'Manager'
      GROUP BY m.id, m.name
      ORDER BY m.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Manager effectiveness error:', error);
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
