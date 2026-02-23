const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const appController = require('../controllers/appController');
const settingsController = require('../controllers/settingsController');
const fileController = require('../controllers/fileController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All admin routes require authentication
router.use(requireAuth);

// Dashboard
router.get('/', adminController.dashboard);

// Settings page (SUPER_ADMIN only)
router.get('/settings', requireRole('SUPER_ADMIN'), settingsController.settingsPage);

// Terminal page (SUPER_ADMIN only)
router.get('/terminal', requireRole('SUPER_ADMIN'), settingsController.terminalPage);

// File Manager (SUPER_ADMIN only)
router.get('/files', requireRole('SUPER_ADMIN'), fileController.filesPage);

// Add new app (SUPER_ADMIN only)
router.post('/app/add', requireRole('SUPER_ADMIN'), appController.addApp);

// Delete app (SUPER_ADMIN only)
router.post('/app/:name/delete', requireRole('SUPER_ADMIN'), appController.deleteApp);

// Flush logs (SUPER_ADMIN and ADMIN only) — must be before :action wildcard
router.post('/app/:name/flush-logs', requireRole('SUPER_ADMIN', 'ADMIN'), appController.flushAppLogs);

// Toggle watch mode (SUPER_ADMIN only)
router.post('/app/:name/toggle-watch', requireRole('SUPER_ADMIN'), appController.toggleWatch);

// App actions (SUPER_ADMIN and ADMIN only) — wildcard, must be LAST
router.post('/app/:name/:action', requireRole('SUPER_ADMIN', 'ADMIN'), appController.appAction);

// Log viewer page
router.get('/app/:name/logs', appController.showLogs);

// API endpoints (for AJAX polling)
router.get('/api/apps', appController.getAppsStatus);
router.get('/api/system', appController.getSystemStatus);
router.get('/api/apps/:name/logs', appController.getAppLogs);
router.get('/api/browse', requireRole('SUPER_ADMIN'), appController.browseDirectory);
router.get('/api/check-env', requireRole('SUPER_ADMIN'), appController.checkEnv);

// File Manager API (SUPER_ADMIN only)
router.get('/api/files/list', requireRole('SUPER_ADMIN'), fileController.apiList);
router.get('/api/files/read', requireRole('SUPER_ADMIN'), fileController.apiRead);
router.post('/api/files/write', requireRole('SUPER_ADMIN'), fileController.apiWrite);
router.post('/api/files/mkdir', requireRole('SUPER_ADMIN'), fileController.apiMkdir);
router.post('/api/files/delete', requireRole('SUPER_ADMIN'), fileController.apiDelete);
router.post('/api/files/rename', requireRole('SUPER_ADMIN'), fileController.apiRename);

// Tunnel API (SUPER_ADMIN only)
router.get('/api/tunnel/status', requireRole('SUPER_ADMIN'), settingsController.getTunnelStatus);
router.post('/api/tunnel/config', requireRole('SUPER_ADMIN'), settingsController.saveTunnelConfig);
router.post('/api/tunnel/start', requireRole('SUPER_ADMIN'), settingsController.startTunnel);
router.post('/api/tunnel/stop', requireRole('SUPER_ADMIN'), settingsController.stopTunnel);
router.post('/api/tunnel/restart', requireRole('SUPER_ADMIN'), settingsController.restartTunnel);
router.post('/api/terminal', requireRole('SUPER_ADMIN'), settingsController.runCommand);

module.exports = router;
