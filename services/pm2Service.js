const { execFile, exec } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// Whitelist of allowed PM2 actions
const ALLOWED_ACTIONS = ['start', 'stop', 'restart'];

/**
 * Get list of all PM2 managed apps
 */
async function listApps() {
  try {
    const { stdout } = await execAsync('pm2 jlist');
    const apps = JSON.parse(stdout);
    return apps.map(app => ({
      name: app.name,
      pm_id: app.pm_id,
      status: app.pm2_env.status,
      cpu: app.monit.cpu,
      memory: app.monit.memory,
      uptime: app.pm2_env.pm_uptime,
      restarts: app.pm2_env.restart_time,
      pid: app.pid,
      script: app.pm2_env.pm_exec_path || '',
      cwd: app.pm2_env.pm_cwd || '',
      watch: app.pm2_env.watch || false
    }));
  } catch (err) {
    console.error('PM2 list error:', err.message);
    return [];
  }
}

/**
 * Validate app name against current PM2 list
 */
async function validateAppName(name) {
  const apps = await listApps();
  return apps.some(app => app.name === name);
}

/**
 * Execute a PM2 action on an app
 */
async function executeAction(name, action) {
  if (!ALLOWED_ACTIONS.includes(action)) {
    throw new Error(`Action "${action}" is not allowed`);
  }

  const isValid = await validateAppName(name);
  if (!isValid) {
    throw new Error(`App "${name}" not found in PM2`);
  }

  // Sanitize: only allow alphanumeric, dash, underscore
  const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (safeName !== name) {
    throw new Error('Invalid app name characters');
  }

  const { stdout } = await execAsync(`pm2 ${action} ${safeName}`);
  return stdout;
}

/**
 * Get logs for an app (last N lines)
 */
async function getLogs(name, lines = 50) {
  const isValid = await validateAppName(name);
  if (!isValid) {
    throw new Error(`App "${name}" not found in PM2`);
  }

  const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (safeName !== name) {
    throw new Error('Invalid app name characters');
  }

  try {
    const { stdout } = await execAsync(`pm2 logs ${safeName} --nostream --lines ${parseInt(lines)}`, {
      timeout: 5000
    });
    return stdout;
  } catch (err) {
    return err.stdout || 'No logs available';
  }
}

/**
 * Flush logs for an app
 */
async function flushLogs(name) {
  const isValid = await validateAppName(name);
  if (!isValid) {
    throw new Error(`App "${name}" not found in PM2`);
  }

  const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '');
  await execAsync(`pm2 flush ${safeName}`);
  return true;
}

/**
 * Add a new app to PM2
 */
async function addApp(name, scriptPath, envContent) {
  // Sanitize name
  const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (!safeName || safeName !== name) {
    throw new Error('App name can only contain letters, numbers, dashes, and underscores');
  }

  // Check if name already exists
  const exists = await validateAppName(safeName);
  if (exists) {
    throw new Error(`App "${safeName}" already exists in PM2`);
  }

  // Validate script path exists
  const fs = require('fs');
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script not found: ${scriptPath}`);
  }

  // Only allow .js files
  if (!scriptPath.endsWith('.js')) {
    throw new Error('Only .js script files are supported');
  }

  // Sanitize path: no shell special characters
  if (/[;&|`$]/.test(scriptPath)) {
    throw new Error('Invalid characters in script path');
  }

  const path = require('path');
  let appDir = path.dirname(scriptPath);

  // Walk upward to find project root (where package.json lives)
  let projectRoot = appDir;
  let dir = appDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      projectRoot = dir;
      break;
    }
    dir = path.dirname(dir);
  }

  // Check .env requirement
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath) && (!envContent || !envContent.trim())) {
    throw new Error('No .env file found in project root. Please provide .env configuration.');
  }

  // Write .env file if content provided
  if (envContent && envContent.trim()) {
    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
  }

  // Parse .env file into env object
  const envVars = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        // Remove surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        envVars[key] = val;
      }
    }
  }

  // Run npm install if package.json exists
  if (fs.existsSync(path.join(projectRoot, 'package.json'))) {
    await execAsync(`npm install --production`, { cwd: projectRoot, timeout: 120000 });
  }

  // Create ecosystem config so env vars override parent process
  // Use relative script path to avoid spaces-in-path issues
  const relativeScript = path.relative(projectRoot, scriptPath);
  const ecoConfig = {
    apps: [{
      name: safeName,
      script: relativeScript,
      cwd: projectRoot,
      env: envVars
    }]
  };
  const ecoPath = path.join(projectRoot, 'ecosystem.config.js');
  fs.writeFileSync(ecoPath, 'module.exports = ' + JSON.stringify(ecoConfig, null, 2) + ';\n', 'utf8');

  const { stdout } = await execAsync('pm2 start ecosystem.config.js', { cwd: projectRoot });
  await execAsync('pm2 save');

  // Clean up ecosystem file
  try { fs.unlinkSync(ecoPath); } catch (e) {}

  return stdout;
}

/**
 * Delete an app from PM2
 */
async function deleteApp(name) {
  const isValid = await validateAppName(name);
  if (!isValid) {
    throw new Error(`App "${name}" not found in PM2`);
  }

  const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (safeName !== name) {
    throw new Error('Invalid app name characters');
  }

  const { stdout } = await execAsync(`pm2 delete ${safeName}`);
  await execAsync('pm2 save');
  return stdout;
}

/**
 * Toggle watch mode for an app
 */
async function toggleWatch(name) {
  const isValid = await validateAppName(name);
  if (!isValid) throw new Error(`App "${name}" not found in PM2`);

  const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (safeName !== name) throw new Error('Invalid app name characters');

  // Get current watch state
  const apps = await listApps();
  const app = apps.find(a => a.name === safeName);
  const watching = app && app.watch;

  if (watching) {
    // Stop watching: restart without watch
    await execAsync(`pm2 stop ${safeName}`);
    await execAsync(`pm2 start ${safeName} --watch false`);
  } else {
    // Start watching
    await execAsync(`pm2 stop ${safeName}`);
    await execAsync(`pm2 start ${safeName} --watch`);
  }
  await execAsync('pm2 save');
  return !watching;
}

module.exports = {
  listApps,
  validateAppName,
  executeAction,
  getLogs,
  flushLogs,
  addApp,
  deleteApp,
  toggleWatch,
  ALLOWED_ACTIONS
};
