const pool = require('../config/database');

/**
 * Log an admin action
 */
async function log(userId, actionType, targetApp, ipAddress) {
  try {
    await pool.execute(
      'INSERT INTO admin_logs (user_id, action_type, target_app, ip_address) VALUES (?, ?, ?, ?)',
      [userId, actionType, targetApp || null, ipAddress || null]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

/**
 * Get recent audit log entries
 */
async function getRecent(limit = 20) {
  try {
    const [rows] = await pool.execute(
      `SELECT al.*, u.username 
       FROM admin_logs al 
       JOIN users u ON al.user_id = u.id 
       ORDER BY al.created_at DESC 
       LIMIT ?`,
      [limit]
    );
    return rows;
  } catch (err) {
    console.error('Audit fetch error:', err.message);
    return [];
  }
}

module.exports = {
  log,
  getRecent
};
