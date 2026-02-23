const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Check if redis is installed
 */
async function isInstalled() {
  try {
    await execAsync('which redis-server');
    return true;
  } catch {
    return false;
  }
}

/**
 * Install redis via Homebrew
 */
async function install() {
  const installed = await isInstalled();
  if (installed) return 'Redis is already installed';

  // Check if brew exists
  try {
    await execAsync('which brew');
  } catch {
    throw new Error('Homebrew is not installed. Please install Homebrew first.');
  }

  await execAsync('brew install redis', { timeout: 120000 });
  return 'Redis installed successfully';
}

/**
 * Get redis status
 */
async function getStatus() {
  try {
    const installed = await isInstalled();
    if (!installed) return { installed: false, running: false, info: null };

    let running = false;
    try {
      const { stdout } = await execAsync('redis-cli ping', { timeout: 3000 });
      running = stdout.trim() === 'PONG';
    } catch { running = false; }

    let info = null;
    if (running) {
      try {
        const { stdout } = await execAsync('redis-cli info server', { timeout: 3000 });
        const lines = stdout.split('\n');
        info = {};
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const idx = trimmed.indexOf(':');
          if (idx > 0) {
            info[trimmed.substring(0, idx)] = trimmed.substring(idx + 1);
          }
        }
      } catch {}
    }

    // Get version
    let version = '';
    try {
      const { stdout } = await execAsync('redis-server --version');
      const match = stdout.match(/v=([\d.]+)/);
      if (match) version = match[1];
    } catch {}

    return { installed: true, running, version, info };
  } catch {
    return { installed: false, running: false, info: null };
  }
}

/**
 * Get redis memory/stats info
 */
async function getInfo() {
  try {
    const { stdout } = await execAsync('redis-cli info', { timeout: 3000 });
    const sections = {};
    let currentSection = 'general';
    const lines = stdout.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        currentSection = trimmed.replace('#', '').trim().toLowerCase();
        sections[currentSection] = {};
        continue;
      }
      if (!trimmed) continue;
      const idx = trimmed.indexOf(':');
      if (idx > 0) {
        if (!sections[currentSection]) sections[currentSection] = {};
        sections[currentSection][trimmed.substring(0, idx)] = trimmed.substring(idx + 1);
      }
    }
    return sections;
  } catch (err) {
    throw new Error('Failed to get Redis info: ' + err.message);
  }
}

/**
 * Start redis
 */
async function start() {
  const installed = await isInstalled();
  if (!installed) throw new Error('Redis is not installed');

  const status = await getStatus();
  if (status.running) return 'Redis is already running';

  await execAsync('brew services start redis', { timeout: 10000 });
  return 'Redis started';
}

/**
 * Stop redis
 */
async function stop() {
  try {
    await execAsync('brew services stop redis', { timeout: 10000 });
    return 'Redis stopped';
  } catch {
    // Try direct shutdown
    try {
      await execAsync('redis-cli shutdown nosave', { timeout: 5000 });
      return 'Redis stopped';
    } catch {
      return 'No Redis process found';
    }
  }
}

/**
 * Restart redis
 */
async function restart() {
  await stop();
  await new Promise(resolve => setTimeout(resolve, 1000));
  return await start();
}

/**
 * Flush all data (dangerous)
 */
async function flushAll() {
  try {
    await execAsync('redis-cli FLUSHALL', { timeout: 5000 });
    return 'All data flushed';
  } catch (err) {
    throw new Error('Failed to flush: ' + err.message);
  }
}

/**
 * Get number of keys per database
 */
async function getKeyCount() {
  try {
    const { stdout } = await execAsync('redis-cli info keyspace', { timeout: 3000 });
    const result = {};
    const lines = stdout.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('db')) {
        const [db, details] = trimmed.split(':');
        const keys = details.match(/keys=(\d+)/);
        result[db] = keys ? parseInt(keys[1]) : 0;
      }
    }
    return result;
  } catch {
    return {};
  }
}

module.exports = {
  isInstalled,
  install,
  getStatus,
  getInfo,
  start,
  stop,
  restart,
  flushAll,
  getKeyCount
};
