const fileService = require('../services/fileService');
const auditService = require('../services/auditService');

/**
 * Render file manager page
 */
async function filesPage(req, res) {
  try {
    const currentPath = req.query.path || '/Users';
    const showHidden = req.query.hidden === '1';
    const result = fileService.listDirectory(currentPath, showHidden);

    res.render('admin/files', {
      title: 'File Manager',
      user: req.session.user,
      currentPath: result.currentPath,
      items: result.items,
      showHidden,
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    res.status(500).render('error', {
      title: 'Error',
      message: err.message,
      user: req.session.user
    });
  }
}

/**
 * API: List directory
 */
async function apiList(req, res) {
  try {
    const currentPath = req.query.path || '/Users';
    const showHidden = req.query.hidden === '1';
    const result = fileService.listDirectory(currentPath, showHidden);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * API: Read file
 */
async function apiRead(req, res) {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ success: false, message: 'Path required' });

    const result = fileService.readFile(filePath);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * API: Write/create file
 */
async function apiWrite(req, res) {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ success: false, message: 'Path required' });

    const result = fileService.writeFile(filePath, content || '');
    await auditService.log(req.session.user.id, 'WRITE FILE', filePath, req.ip);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * API: Create directory
 */
async function apiMkdir(req, res) {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) return res.status(400).json({ success: false, message: 'Path required' });

    const result = fileService.createDirectory(dirPath);
    await auditService.log(req.session.user.id, 'CREATE DIR', dirPath, req.ip);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * API: Delete file/directory
 */
async function apiDelete(req, res) {
  try {
    const { path: itemPath } = req.body;
    if (!itemPath) return res.status(400).json({ success: false, message: 'Path required' });

    const result = fileService.deleteItem(itemPath);
    await auditService.log(req.session.user.id, 'DELETE FILE', itemPath, req.ip);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * API: Rename file/directory
 */
async function apiRename(req, res) {
  try {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) return res.status(400).json({ success: false, message: 'Both paths required' });

    const result = fileService.renameItem(oldPath, newPath);
    await auditService.log(req.session.user.id, 'RENAME FILE', `${oldPath} → ${newPath}`, req.ip);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  filesPage,
  apiList,
  apiRead,
  apiWrite,
  apiMkdir,
  apiDelete,
  apiRename
};
