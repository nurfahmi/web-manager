const pool = require('../config/database');

/**
 * Check MySQL connection status
 */
async function checkConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return {
      connected: true,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get list of databases
 */
async function listDatabases() {
  try {
    const [rows] = await pool.execute('SHOW DATABASES');
    return rows
      .map(r => r.Database)
      .filter(db => !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(db));
  } catch (err) {
    console.error('List databases error:', err.message);
    return [];
  }
}

module.exports = {
  checkConnection,
  listDatabases
};
