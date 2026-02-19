const tunnelService = require('../services/tunnelService');
const auditService = require('../services/auditService');

/**
 * Render settings page
 */
async function settingsPage(req, res) {
  try {
    const tunnelStatus = await tunnelService.getStatus();
    const tunnelConfig = tunnelService.getConfig();

    res.render('admin/settings', {
      title: 'Settings — Indosofthouse App Panel',
      user: req.session.user,
      csrfToken: req.csrfToken(),
      tunnelStatus,
      tunnelConfig
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
 * Install cloudflared
 */
async function installCloudflared(req, res) {
  try {
    await tunnelService.install();
    await auditService.log(req.session.user.id, 'INSTALL CLOUDFLARED', 'system', req.ip);
    res.json({ success: true, message: 'cloudflared installed successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
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
 * Create tunnel
 */
async function createTunnel(req, res) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Tunnel name required' });

    const result = await tunnelService.createTunnel(name);
    await auditService.log(req.session.user.id, 'CREATE TUNNEL', name, req.ip);
    res.json({ success: true, message: result });
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
  installCloudflared,
  saveTunnelConfig,
  startTunnel,
  stopTunnel,
  runCommand,
  terminalPage
};
