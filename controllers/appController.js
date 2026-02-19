const pm2Service = require('../services/pm2Service');
const systemService = require('../services/systemService');
const dbService = require('../services/dbService');
const auditService = require('../services/auditService');

/**
 * Execute PM2 action (start/stop/restart)
 */
async function appAction(req, res) {
  const { name, action } = req.params;

  try {
    await pm2Service.executeAction(name, action);
    await auditService.log(
      req.session.user.id,
      `${action.toUpperCase()} APP`,
      name,
      req.ip
    );
    res.json({ success: true, message: `${action} executed on ${name}` });
  } catch (err) {
    console.error('App action error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Get app logs (JSON API)
 */
async function getAppLogs(req, res) {
  const { name } = req.params;
  const lines = parseInt(req.query.lines) || 50;

  try {
    const logs = await pm2Service.getLogs(name, lines);
    await auditService.log(req.session.user.id, 'VIEW LOGS', name, req.ip);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Flush app logs
 */
async function flushAppLogs(req, res) {
  const { name } = req.params;

  try {
    await pm2Service.flushLogs(name);
    await auditService.log(req.session.user.id, 'FLUSH LOGS', name, req.ip);
    res.json({ success: true, message: `Logs cleared for ${name}` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Render log viewer page
 */
async function showLogs(req, res) {
  const { name } = req.params;

  try {
    const isValid = await pm2Service.validateAppName(name);
    if (!isValid) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: `App "${name}" not found in PM2.`,
        user: req.session.user
      });
    }

    const logs = await pm2Service.getLogs(name, 100);
    await auditService.log(req.session.user.id, 'VIEW LOGS', name, req.ip);

    res.render('admin/logs', {
      title: `Logs — ${name}`,
      user: req.session.user,
      appName: name,
      logs,
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    console.error('Show logs error:', err);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load logs.',
      user: req.session.user
    });
  }
}

/**
 * API: Get all apps status (for AJAX polling)
 */
async function getAppsStatus(req, res) {
  try {
    const apps = await pm2Service.listApps();
    res.json({ success: true, apps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * API: Get system metrics (for AJAX polling)
 */
async function getSystemStatus(req, res) {
  try {
    const [metrics, versions, dbStatus] = await Promise.all([
      systemService.getMetrics(),
      systemService.getVersions(),
      dbService.checkConnection()
    ]);
    res.json({ success: true, metrics, versions, dbStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Add new app to PM2
 */
async function addApp(req, res) {
  const { name, scriptPath, envContent } = req.body;

  if (!name || !scriptPath) {
    return res.status(400).json({ success: false, message: 'App name and script path are required' });
  }

  try {
    await pm2Service.addApp(name.trim(), scriptPath.trim(), envContent || '');
    await auditService.log(req.session.user.id, 'ADD APP', name.trim(), req.ip);
    res.json({ success: true, message: `App "${name.trim()}" added successfully` });
  } catch (err) {
    console.error('Add app error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Delete app from PM2
 */
async function deleteApp(req, res) {
  const { name } = req.params;

  try {
    await pm2Service.deleteApp(name);
    await auditService.log(req.session.user.id, 'DELETE APP', name, req.ip);
    res.json({ success: true, message: `App "${name}" removed from PM2` });
  } catch (err) {
    console.error('Delete app error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * API: Browse directory for file picker
 */
async function browseDirectory(req, res) {
  const fs = require('fs');
  const path = require('path');
  const requestedPath = req.query.path || '/Users';

  try {
    // Security: resolve to prevent directory traversal
    const resolvedPath = path.resolve(requestedPath);

    if (!fs.existsSync(resolvedPath)) {
      return res.json({ success: false, message: 'Directory not found' });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return res.json({ success: false, message: 'Not a directory' });
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const items = [];

    // Add parent directory
    const parentDir = path.dirname(resolvedPath);
    if (parentDir !== resolvedPath) {
      items.push({ name: '..', path: parentDir, type: 'directory' });
    }

    for (const entry of entries) {
      // Skip hidden files/folders and node_modules (unless showHidden)
      if (entry.name === 'node_modules') continue;
      if (entry.name.startsWith('.') && !req.query.showHidden) continue;

      const fullPath = path.join(resolvedPath, entry.name);

      if (entry.isDirectory()) {
        items.push({ name: entry.name, path: fullPath, type: 'directory' });
      } else if (entry.name.endsWith('.js')) {
        items.push({ name: entry.name, path: fullPath, type: 'file' });
      } else if (req.query.ext && entry.name.endsWith('.' + req.query.ext)) {
        items.push({ name: entry.name, path: fullPath, type: 'file' });
      }
    }

    // Sort: directories first, then files
    items.sort((a, b) => {
      if (a.name === '..') return -1;
      if (b.name === '..') return 1;
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ success: true, currentPath: resolvedPath, items });
  } catch (err) {
    res.json({ success: false, message: 'Cannot read directory' });
  }
}

/**
 * Toggle watch mode for an app
 */
async function toggleWatch(req, res) {
  const { name } = req.params;
  try {
    const watching = await pm2Service.toggleWatch(name);
    await auditService.log(req.session.user.id, watching ? 'ENABLE WATCH' : 'DISABLE WATCH', name, req.ip);
    res.json({ success: true, watching, message: `Watch ${watching ? 'enabled' : 'disabled'} for ${name}` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Check if .env exists for a script path
 */
async function checkEnv(req, res) {
  const fs = require('fs');
  const path = require('path');
  const scriptPath = req.query.script;
  if (!scriptPath) return res.json({ exists: false });

  let dir = path.dirname(scriptPath);
  let projectRoot = dir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      projectRoot = dir;
      break;
    }
    dir = path.dirname(dir);
  }

  const envPath = path.join(projectRoot, '.env');
  const examplePath = path.join(projectRoot, '.env.example');
  const exists = fs.existsSync(envPath);
  let example = '';
  if (!exists && fs.existsSync(examplePath)) {
    example = fs.readFileSync(examplePath, 'utf8');
  }
  res.json({ exists, example, projectRoot });
}

module.exports = {
  appAction,
  getAppLogs,
  flushAppLogs,
  showLogs,
  getAppsStatus,
  getSystemStatus,
  addApp,
  deleteApp,
  browseDirectory,
  toggleWatch,
  checkEnv
};
