const pm2Service = require('../services/pm2Service');
const systemService = require('../services/systemService');
const dbService = require('../services/dbService');
const auditService = require('../services/auditService');

/**
 * Render admin dashboard
 */
async function dashboard(req, res) {
  try {
    const [apps, metrics, versions, dbStatus, recentLogs] = await Promise.all([
      pm2Service.listApps(),
      systemService.getMetrics(),
      systemService.getVersions(),
      dbService.checkConnection(),
      auditService.getRecent(10)
    ]);

    res.render('admin/dashboard', {
      title: 'Dashboard',
      user: req.session.user,
      apps,
      metrics,
      versions,
      dbStatus,
      recentLogs,
      formatBytes: systemService.formatBytes,
      formatUptime: systemService.formatUptime,
      phpMyAdminUrl: process.env.PHPMYADMIN_URL || 'http://localhost:8081',
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load dashboard.',
      user: req.session.user
    });
  }
}

module.exports = { dashboard };
