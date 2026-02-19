const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Get system metrics
 */
async function getMetrics() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();

  // macOS: use vm_stat for accurate memory (os.freemem is misleading)
  let usedMem, freeMem;
  try {
    const { stdout } = await execAsync('vm_stat');
    const pageSize = parseInt(stdout.match(/page size of (\d+)/)?.[1]) || 16384;
    const parse = (label) => {
      const match = stdout.match(new RegExp(`${label}:\\s+(\\d+)`));
      return match ? parseInt(match[1]) * pageSize : 0;
    };
    const active = parse('Pages active');
    const wired = parse('Pages wired down');
    // Only active + wired = actually used (like Activity Monitor)
    usedMem = active + wired;
    freeMem = totalMem - usedMem;
  } catch (e) {
    // Fallback
    freeMem = os.freemem();
    usedMem = totalMem - freeMem;
  }

  // CPU usage calculation
  let totalIdle = 0, totalTick = 0;
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  const cpuUsage = Math.round((1 - totalIdle / totalTick) * 100);

  // Disk usage (macOS)
  let diskUsage = { total: 0, used: 0, available: 0, percent: 0 };
  try {
    const { stdout } = await execAsync("df -k / | tail -1 | awk '{print $2, $3, $4, $5}'");
    const parts = stdout.trim().split(/\s+/);
    if (parts.length >= 4) {
      diskUsage = {
        total: parseInt(parts[0]) * 1024,
        used: parseInt(parts[1]) * 1024,
        available: parseInt(parts[2]) * 1024,
        percent: parseInt(parts[3])
      };
    }
  } catch (err) {
    console.error('Disk usage error:', err.message);
  }

  return {
    cpu: {
      usage: cpuUsage,
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown'
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percent: Math.round((usedMem / totalMem) * 100)
    },
    disk: diskUsage,
    uptime: os.uptime(),
    loadAvg: os.loadavg(),
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname()
  };
}

/**
 * Get software versions
 */
async function getVersions() {
  const nodeVersion = process.version;

  let pm2Version = 'N/A';
  try {
    const { stdout } = await execAsync('pm2 --version');
    pm2Version = stdout.trim();
  } catch (err) {
    console.error('PM2 version error:', err.message);
  }

  return { nodeVersion, pm2Version };
}

/**
 * Format bytes to human-readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format seconds to human-readable uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

module.exports = {
  getMetrics,
  getVersions,
  formatBytes,
  formatUptime
};
