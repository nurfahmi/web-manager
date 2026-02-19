const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

/**
 * Check if cloudflared is installed
 */
async function isInstalled() {
  try {
    await execAsync('which cloudflared');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get tunnel status
 */
async function getStatus() {
  try {
    const installed = await isInstalled();
    if (!installed) return { installed: false, running: false, tunnels: [] };

    // Check if tunnel service is running
    let running = false;
    try {
      const { stdout } = await execAsync('pgrep -f cloudflared');
      running = stdout.trim().length > 0;
    } catch { running = false; }

    // List tunnels
    let tunnels = [];
    try {
      const { stdout } = await execAsync('cloudflared tunnel list --output json 2>/dev/null');
      tunnels = JSON.parse(stdout || '[]');
    } catch { tunnels = []; }

    return { installed: true, running, tunnels };
  } catch {
    return { installed: false, running: false, tunnels: [] };
  }
}

/**
 * Install cloudflared via Homebrew
 */
async function install() {
  const { stdout } = await execAsync('brew install cloudflared');
  return stdout;
}

/**
 * Login to Cloudflare (generates cert)
 */
async function login() {
  // This opens browser, we just need to start the process
  const { stdout } = await execAsync('cloudflared tunnel login 2>&1 || true', { timeout: 5000 });
  return stdout;
}

/**
 * Create a new tunnel
 */
async function createTunnel(name) {
  const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (!safeName) throw new Error('Invalid tunnel name');

  const { stdout } = await execAsync(`cloudflared tunnel create ${safeName}`);
  return stdout;
}

/**
 * Get or create config file
 */
function getConfigPath() {
  const homeDir = require('os').homedir();
  return path.join(homeDir, '.cloudflared', 'config.yml');
}

function getConfig() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    return fs.readFileSync(configPath, 'utf8');
  }
  return '';
}

function saveConfig(content) {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, content, 'utf8');
}

/**
 * Start tunnel
 */
async function startTunnel() {
  try {
    const config = getConfig();
    if (!config) throw new Error('No config file found. Please configure first.');

    // Check if already running
    try {
      const { stdout } = await execAsync('pgrep -f "cloudflared tunnel run"');
      if (stdout.trim()) return 'Tunnel already running';
    } catch {}

    const { spawn } = require('child_process');
    const child = spawn('cloudflared', ['tunnel', '--config', getConfigPath(), 'run'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    return 'Tunnel started';
  } catch (err) {
    throw new Error('Failed to start tunnel: ' + err.message);
  }
}

/**
 * Install as system service (auto-start on boot)
 */
async function installService() {
  const { stdout } = await execAsync('sudo cloudflared service install 2>&1');
  return stdout;
}

/**
 * Stop tunnel service
 */
async function stopTunnel() {
  try {
    await execAsync('pkill -f "cloudflared tunnel" || true');
    return 'Tunnel stopped';
  } catch {
    return 'No tunnel process found';
  }
}

/**
 * Delete a tunnel by name
 */
async function deleteTunnel(name) {
  const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (!safeName) throw new Error('Invalid tunnel name');
  const { stdout } = await execAsync(`cloudflared tunnel delete ${safeName} 2>&1`);
  return stdout;
}

/**
 * Switch Cloudflare account (delete cert and re-login)
 */
async function switchAccount() {
  const homeDir = require('os').homedir();
  const certPath = path.join(homeDir, '.cloudflared', 'cert.pem');
  if (fs.existsSync(certPath)) {
    fs.unlinkSync(certPath);
  }
  return 'Certificate removed. Run "cloudflared tunnel login" in the terminal below to login with a new account.';
}

module.exports = {
  isInstalled,
  getStatus,
  install,
  login,
  createTunnel,
  getConfig,
  saveConfig,
  getConfigPath,
  startTunnel,
  stopTunnel,
  installService,
  deleteTunnel,
  switchAccount
};
