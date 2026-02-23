const tunnelService = require('../services/tunnelService');
const redisService = require('../services/redisService');
const auditService = require('../services/auditService');

/**
 * Render settings page
 */
async function settingsPage(req, res) {
  try {
    const tunnelStatus = await tunnelService.getStatus();
    const tunnelConfig = tunnelService.getConfig();
    const redisStatus = await redisService.getStatus();

    res.render('admin/settings', {
      title: 'Settings — Indosofthouse App Panel',
      user: req.session.user,
      csrfToken: req.csrfToken(),
      tunnelStatus,
      tunnelConfig,
      redisStatus
    });
  } catch (err) {
    console.error('Settings page error:', err);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load settings.',
      user: req.session.user
    });
  }
}

/**
 * API: Get tunnel status
 */
async function getTunnelStatus(req, res) {
  try {
    const status = await tunnelService.getStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
}

/**
 * Save tunnel config
 */
async function saveTunnelConfig(req, res) {
  try {
    const { config } = req.body;
    if (!config) return res.status(400).json({ success: false, message: 'Config is empty' });

    tunnelService.saveConfig(config);
    await auditService.log(req.session.user.id, 'UPDATE TUNNEL CONFIG', 'cloudflare', req.ip);
    res.json({ success: true, message: 'Config saved to ' + tunnelService.getConfigPath() });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Start tunnel
 */
async function startTunnel(req, res) {
  try {
    const result = await tunnelService.startTunnel();
    await auditService.log(req.session.user.id, 'START TUNNEL', 'cloudflare', req.ip);
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Stop tunnel
 */
async function stopTunnel(req, res) {
  try {
    const result = await tunnelService.stopTunnel();
    await auditService.log(req.session.user.id, 'STOP TUNNEL', 'cloudflare', req.ip);
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Restart tunnel (stop then start)
 */
async function restartTunnel(req, res) {
  try {
    await tunnelService.stopTunnel();
    // Small delay to ensure process fully stops
    await new Promise(resolve => setTimeout(resolve, 1000));
    const result = await tunnelService.startTunnel();
    await auditService.log(req.session.user.id, 'RESTART TUNNEL', 'cloudflare', req.ip);
    res.json({ success: true, message: 'Tunnel restarted' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// === Redis Endpoints ===

async function getRedisStatus(req, res) {
  try {
    const status = await redisService.getStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
}

async function installRedis(req, res) {
  try {
    const result = await redisService.install();
    await auditService.log(req.session.user.id, 'INSTALL REDIS', 'redis', req.ip);
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function startRedis(req, res) {
  try {
    const result = await redisService.start();
    await auditService.log(req.session.user.id, 'START REDIS', 'redis', req.ip);
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function stopRedis(req, res) {
  try {
    const result = await redisService.stop();
    await auditService.log(req.session.user.id, 'STOP REDIS', 'redis', req.ip);
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function restartRedis(req, res) {
  try {
    const result = await redisService.restart();
    await auditService.log(req.session.user.id, 'RESTART REDIS', 'redis', req.ip);
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function flushRedis(req, res) {
  try {
    const result = await redisService.flushAll();
    await auditService.log(req.session.user.id, 'FLUSH REDIS', 'redis', req.ip);
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getRedisInfo(req, res) {
  try {
    const info = await redisService.getInfo();
    const keys = await redisService.getKeyCount();
    res.json({ success: true, info, keys });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
}

/**
 * Run a shell command (SUPER_ADMIN only)
 */
async function runCommand(req, res) {
  const { exec } = require('child_process');
  const { command } = req.body;

  if (!command || !command.trim()) {
    return res.json({ success: false, output: 'No command provided' });
  }

  const cmd = command.trim();

  // Block dangerous commands
  const blocked = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'shutdown', 'reboot'];
  if (blocked.some(b => cmd.includes(b))) {
    return res.json({ success: false, output: 'Command blocked for safety' });
  }

  await auditService.log(req.session.user.id, 'RUN COMMAND', cmd.substring(0, 100), req.ip);

  exec(cmd, { timeout: 30000, maxBuffer: 1024 * 512, shell: '/bin/zsh' }, (err, stdout, stderr) => {
    const output = (stdout || '') + (stderr || '');
    res.json({ success: !err, output: output || (err ? err.message : 'Done (no output)') });
  });
}

/**
 * Render terminal page
 */
async function terminalPage(req, res) {
  try {
    const systemService = require('../services/systemService');
    const metrics = await systemService.getMetrics();
    res.render('admin/terminal', {
      title: 'Terminal — Indosofthouse App Panel',
      user: req.session.user,
      csrfToken: req.csrfToken(),
      metrics
    });
  } catch (err) {
    console.error('Terminal page error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load terminal.', user: req.session.user });
  }
}

module.exports = {
  settingsPage,
  getTunnelStatus,
  saveTunnelConfig,
  startTunnel,
  stopTunnel,
  restartTunnel,
  runCommand,
  terminalPage,
  getRedisStatus,
  installRedis,
  startRedis,
  stopRedis,
  restartRedis,
  flushRedis,
  getRedisInfo
};
