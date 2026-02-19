/**
 * Dashboard AJAX Polling & Action Handlers
 */

const csrfToken = document.getElementById('csrfToken')?.value;
const userRole = document.getElementById('userRole')?.value;

/**
 * Show toast notification (Tailwind-based)
 */
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-brand-600'
  };
  const icons = {
    success: 'bi-check-circle-fill',
    error: 'bi-x-circle-fill',
    info: 'bi-info-circle-fill'
  };

  const toast = document.createElement('div');
  toast.className = `${colors[type] || colors.info} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 mb-2 min-w-72 animate-slide-in`;
  toast.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><div><div class="font-semibold text-sm">${title}</div><div class="text-xs opacity-90">${message}</div></div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Execute PM2 action on app
 */
async function appAction(name, action) {
  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
  if (!confirm(`${actionLabel} "${name}"?`)) return;

  try {
    const res = await fetch(`/admin/app/${name}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Success', data.message, 'success');
      setTimeout(refreshAll, 1500);
    } else {
      showToast('Error', data.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to execute action', 'error');
  }
}

/**
 * Format bytes
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Refresh system metrics
 */
async function refreshSystem() {
  try {
    const res = await fetch('/admin/api/system');
    const data = await res.json();
    if (data.success) {
      document.getElementById('stat-uptime').textContent = formatUptime(data.metrics.uptime);
      document.getElementById('stat-cpu').textContent = data.metrics.cpu.usage + '%';
      document.getElementById('stat-memory').textContent = data.metrics.memory.percent + '%';
      document.getElementById('stat-memory-detail').textContent = formatBytes(data.metrics.memory.used) + ' / ' + formatBytes(data.metrics.memory.total);
      document.getElementById('stat-disk').textContent = data.metrics.disk.percent + '%';
      document.getElementById('stat-disk-detail').textContent = formatBytes(data.metrics.disk.used) + ' / ' + formatBytes(data.metrics.disk.total);
    }
  } catch (err) {
    console.error('System refresh error:', err);
  }
}

/**
 * Refresh PM2 apps table
 */
async function refreshApps() {
  try {
    const res = await fetch('/admin/api/apps');
    const data = await res.json();
    if (!data.success || !data.apps) return;

    const tbody = document.getElementById('appsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    data.apps.forEach(app => {
      const statusMap = {
        online: `<span class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Online</span>`,
        stopped: `<span class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"><span class="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>Stopped</span>`,
        errored: `<span class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"><span class="w-1.5 h-1.5 bg-red-500 rounded-full"></span>Errored</span>`
      };
      const statusBadge = statusMap[app.status] || `<span class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"><span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>${app.status}</span>`;

      const memory = app.memory ? (app.memory / 1024 / 1024).toFixed(1) + ' MB' : '—';
      const cpu = typeof app.cpu !== 'undefined' ? app.cpu + '%' : '—';
      const uptime = app.uptime && app.status === 'online' ? formatUptime((Date.now() - app.uptime) / 1000) : '—';
      const restartClass = app.restarts > 5 ? 'text-amber-500 font-medium' : 'text-gray-600 dark:text-gray-400';

      let actions = '';
      if (userRole !== 'STAFF') {
        if (app.status !== 'online') {
          actions += `<button onclick="appAction('${app.name}','start')" class="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors" title="Start"><i class="bi bi-play-fill"></i></button>`;
        }
        if (app.status === 'online') {
          actions += `<button onclick="appAction('${app.name}','restart')" class="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors" title="Restart"><i class="bi bi-arrow-repeat"></i></button>`;
          actions += `<button onclick="appAction('${app.name}','stop')" class="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors" title="Stop"><i class="bi bi-stop-fill"></i></button>`;
        }
      }
      actions += `<a href="/admin/app/${app.name}/logs" class="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/30 text-brand-600 dark:text-brand-400 transition-colors" title="Logs"><i class="bi bi-journal-text"></i></a>`;
      if (userRole === 'SUPER_ADMIN') {
        const watchClass = app.watch ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400';
        const watchIcon = app.watch ? 'bi-eye-fill' : 'bi-eye';
        const watchTitle = app.watch ? 'Watch ON — click to disable' : 'Watch OFF — click to enable';
        actions += `<button onclick="toggleWatch('${app.name}', this)" class="p-1.5 rounded-lg transition-colors ${watchClass}" title="${watchTitle}"><i class="bi ${watchIcon}"></i></button>`;
        const appDir = app.cwd || '';
        actions += `<button onclick="openAppTerminal('${app.name}', '${appDir}')" class="p-1.5 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 transition-colors" title="Terminal"><i class="bi bi-terminal"></i></button>`;
        actions += `<button onclick="deleteApp('${app.name}')" class="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors" title="Remove"><i class="bi bi-trash"></i></button>`;
      }

      tbody.insertAdjacentHTML('beforeend', `
        <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" data-app="${app.name}">
          <td class="px-5 py-3"><div class="font-semibold">${app.name}</div><div class="text-xs text-gray-400">PID: ${app.pid}</div></td>
          <td class="px-5 py-3">${statusBadge}</td>
          <td class="px-5 py-3 text-gray-600 dark:text-gray-400">${memory}</td>
          <td class="px-5 py-3 text-gray-600 dark:text-gray-400">${cpu}</td>
          <td class="px-5 py-3 text-gray-600 dark:text-gray-400">${uptime}</td>
          <td class="px-5 py-3"><span class="${restartClass}">${app.restarts || 0}</span></td>
          <td class="px-5 py-3 text-right"><div class="flex items-center justify-end gap-1">${actions}</div></td>
        </tr>
      `);
    });
  } catch (err) {
    console.error('Apps refresh error:', err);
  }
}

/**
 * Add new app to PM2
 */
async function addApp() {
  const name = document.getElementById('appNameInput').value.trim();
  const scriptPath = document.getElementById('scriptPathInput').value.trim();
  const errorEl = document.getElementById('addAppError');
  const btn = document.getElementById('addAppBtn');

  errorEl.classList.add('hidden');

  if (!name) { errorEl.textContent = 'Please enter an application name'; errorEl.classList.remove('hidden'); return; }
  if (!scriptPath) { errorEl.textContent = 'Please enter the script path — use Browse to select a .js file'; errorEl.classList.remove('hidden'); return; }
  if (!/^[a-zA-Z0-9\-_]+$/.test(name)) { errorEl.textContent = 'App name can only contain letters, numbers, dashes and underscores'; errorEl.classList.remove('hidden'); return; }

  const envContent = document.getElementById('envContentInput').value.trim();

  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split mr-1 animate-spin"></i>Adding...';

  try {
    const res = await fetch('/admin/app/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken },
      body: JSON.stringify({ name, scriptPath, envContent })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('addAppModal').classList.add('hidden');
      document.getElementById('appNameInput').value = '';
      document.getElementById('scriptPathInput').value = '';
      document.getElementById('envContentInput').value = '';
      showToast('Success', data.message, 'success');
      setTimeout(refreshAll, 1500);
    } else {
      errorEl.textContent = data.message;
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    errorEl.textContent = 'Failed to add app. Please try again.';
    errorEl.classList.remove('hidden');
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-plus-lg mr-1"></i>Add & Start App';
}

/**
 * Delete app from PM2
 */
async function deleteApp(name) {
  if (!confirm(`Remove "${name}" from PM2?\n\nThis will stop the app and remove it from PM2.\nThe app files will NOT be deleted.`)) return;

  try {
    const res = await fetch(`/admin/app/${name}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Success', data.message, 'success');
      setTimeout(refreshAll, 1500);
    } else {
      showToast('Error', data.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to remove app', 'error');
  }
}

/**
 * Refresh everything
 */
function refreshAll() {
  refreshSystem();
  refreshApps();
  const el = document.getElementById('lastRefresh');
  if (el) el.textContent = 'Updated: ' + new Date().toLocaleTimeString();
}

/**
 * Toggle watch mode
 */
async function toggleWatch(name, btn) {
  try {
    btn.disabled = true;
    const res = await fetch(`/admin/app/${name}/toggle-watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Success', data.message, 'success');
      setTimeout(refreshAll, 2000);
    } else {
      showToast('Error', data.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to toggle watch', 'error');
  }
  btn.disabled = false;
}

// Auto-refresh every 15 seconds
setInterval(refreshAll, 15000);

/**
 * File Browser
 */
function toggleBrowser() {
  const browser = document.getElementById('fileBrowser');
  if (browser.classList.contains('hidden')) {
    browser.classList.remove('hidden');
    browseTo('/Users');
  } else {
    browser.classList.add('hidden');
  }
}

async function browseTo(dirPath) {
  const fileList = document.getElementById('fileList');
  const pathLabel = document.getElementById('currentPathLabel');

  fileList.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm"><i class="bi bi-hourglass-split mr-1"></i>Loading...</div>';
  pathLabel.textContent = dirPath;

  try {
    const res = await fetch(`/admin/api/browse?path=${encodeURIComponent(dirPath)}`);
    const data = await res.json();

    if (!data.success) {
      fileList.innerHTML = `<div class="text-center py-4 text-red-400 text-sm">${data.message}</div>`;
      return;
    }

    pathLabel.textContent = data.currentPath;
    fileList.innerHTML = '';

    if (data.items.length === 0) {
      fileList.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">Empty folder — no .js files</div>';
      return;
    }

    data.items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'px-4 py-2.5 flex items-center gap-3 cursor-pointer border-b border-gray-100 dark:border-gray-800 transition-colors text-sm';

      if (item.type === 'directory') {
        el.innerHTML = `<i class="bi bi-folder-fill text-amber-500"></i><span>${item.name}</span>`;
        el.onmouseover = () => el.classList.add('bg-gray-50', 'dark:bg-gray-800/50');
        el.onmouseout = () => el.classList.remove('bg-gray-50', 'dark:bg-gray-800/50');
        el.onclick = () => browseTo(item.path);
      } else {
        el.innerHTML = `<i class="bi bi-filetype-js text-green-500"></i><span class="text-green-600 dark:text-green-400 font-medium">${item.name}</span>`;
        el.onmouseover = () => el.classList.add('bg-green-50', 'dark:bg-green-900/10');
        el.onmouseout = () => el.classList.remove('bg-green-50', 'dark:bg-green-900/10');
        el.onclick = async () => {
          document.getElementById('scriptPathInput').value = item.path;
          document.getElementById('fileBrowser').classList.add('hidden');
          showToast('File Selected', item.name, 'success');
          // Check if .env exists
          try {
            const envRes = await fetch(`/admin/api/check-env?script=${encodeURIComponent(item.path)}`);
            const envData = await envRes.json();
            const textarea = document.getElementById('envContentInput');
            const label = textarea.parentElement.querySelector('label');
            if (!envData.exists) {
              textarea.classList.add('border-amber-500', 'ring-1', 'ring-amber-500');
              textarea.classList.remove('border-gray-300', 'dark:border-gray-700');
              label.innerHTML = '.env Configuration <span class="text-xs text-amber-500 font-medium">(required — no .env found)</span>';
              if (envData.example) {
                textarea.value = envData.example;
                showToast('Info', '.env.example found — pre-filled for you', 'info');
              }
              textarea.focus();
            } else {
              textarea.classList.remove('border-amber-500', 'ring-1', 'ring-amber-500');
              textarea.classList.add('border-gray-300', 'dark:border-gray-700');
              label.innerHTML = '.env Configuration <span class="text-xs text-gray-400 font-normal">(optional — .env already exists)</span>';
            }
          } catch (e) {}
        };
      }
      fileList.appendChild(el);
    });
  } catch (err) {
    fileList.innerHTML = '<div class="text-center py-4 text-red-400 text-sm">Failed to browse</div>';
  }
}
