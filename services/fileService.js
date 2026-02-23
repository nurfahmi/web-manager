const fs = require('fs');
const path = require('path');

// Blocked paths that should never be modified
const BLOCKED_PATHS = ['/bin', '/sbin', '/usr/bin', '/usr/sbin', '/System', '/Library'];

function isPathSafe(targetPath) {
  const resolved = path.resolve(targetPath);
  if (BLOCKED_PATHS.some(bp => resolved.startsWith(bp))) return false;
  if (/[;&|`$]/.test(targetPath)) return false;
  return true;
}

/**
 * List files and directories
 */
function listDirectory(dirPath, showHidden = false) {
  const resolved = path.resolve(dirPath);

  if (!fs.existsSync(resolved)) throw new Error('Directory not found');
  if (!fs.statSync(resolved).isDirectory()) throw new Error('Not a directory');

  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  const items = [];

  // Parent directory
  const parent = path.dirname(resolved);
  if (parent !== resolved) {
    items.push({ name: '..', path: parent, type: 'directory', size: null });
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && !showHidden) continue;
    if (entry.name === 'node_modules') continue;

    const fullPath = path.join(resolved, entry.name);
    let size = null;
    let modified = null;

    try {
      const stat = fs.statSync(fullPath);
      size = stat.size;
      modified = stat.mtime;
    } catch (e) {}

    items.push({
      name: entry.name,
      path: fullPath,
      type: entry.isDirectory() ? 'directory' : 'file',
      size,
      modified
    });
  }

  // Sort: directories first, then files, alphabetical
  items.sort((a, b) => {
    if (a.name === '..') return -1;
    if (b.name === '..') return 1;
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { currentPath: resolved, items };
}

/**
 * Read file content
 */
function readFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error('File not found');
  if (fs.statSync(resolved).isDirectory()) throw new Error('Cannot read a directory');

  const stat = fs.statSync(resolved);
  // Don't read files larger than 2MB
  if (stat.size > 2 * 1024 * 1024) throw new Error('File too large (max 2MB)');

  // Check if binary
  const ext = path.extname(resolved).toLowerCase();
  const textExts = ['.js', '.json', '.ts', '.html', '.css', '.ejs', '.md', '.txt', '.yml', '.yaml',
    '.env', '.sh', '.sql', '.xml', '.csv', '.log', '.conf', '.cfg', '.ini', '.toml',
    '.jsx', '.tsx', '.vue', '.svelte', '.py', '.rb', '.php', '.java', '.go', '.rs',
    '.cjs', '.mjs', '.lock', '.gitignore', '.dockerignore', '.editorconfig'];

  const isText = textExts.includes(ext) || ext === '';
  if (!isText) throw new Error('Binary files cannot be viewed');

  const content = fs.readFileSync(resolved, 'utf8');
  return { content, size: stat.size, modified: stat.mtime, name: path.basename(resolved) };
}

/**
 * Create or update a file
 */
function writeFile(filePath, content) {
  const resolved = path.resolve(filePath);
  if (!isPathSafe(resolved)) throw new Error('Path is restricted');

  // Ensure parent directory exists
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(resolved, content, 'utf8');
  return { path: resolved, size: Buffer.byteLength(content, 'utf8') };
}

/**
 * Create directory
 */
function createDirectory(dirPath) {
  const resolved = path.resolve(dirPath);
  if (!isPathSafe(resolved)) throw new Error('Path is restricted');
  if (fs.existsSync(resolved)) throw new Error('Already exists');

  fs.mkdirSync(resolved, { recursive: true });
  return { path: resolved };
}

/**
 * Delete file or empty directory
 */
function deleteItem(itemPath) {
  const resolved = path.resolve(itemPath);
  if (!isPathSafe(resolved)) throw new Error('Path is restricted');
  if (!fs.existsSync(resolved)) throw new Error('Not found');

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    fs.rmSync(resolved, { recursive: true });
  } else {
    fs.unlinkSync(resolved);
  }
  return { deleted: resolved };
}

/**
 * Rename/move file or directory
 */
function renameItem(oldPath, newPath) {
  const resolvedOld = path.resolve(oldPath);
  const resolvedNew = path.resolve(newPath);
  if (!isPathSafe(resolvedOld) || !isPathSafe(resolvedNew)) throw new Error('Path is restricted');
  if (!fs.existsSync(resolvedOld)) throw new Error('Source not found');
  if (fs.existsSync(resolvedNew)) throw new Error('Destination already exists');

  fs.renameSync(resolvedOld, resolvedNew);
  return { from: resolvedOld, to: resolvedNew };
}

module.exports = {
  listDirectory,
  readFile,
  writeFile,
  createDirectory,
  deleteItem,
  renameItem
};
