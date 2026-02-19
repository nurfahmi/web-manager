const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const auditService = require('../services/auditService');

/**
 * Show login page
 */
async function showLogin(req, res) {
  if (req.session && req.session.user) {
    return res.redirect('/admin');
  }
  // Redirect to setup if no users exist
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) return res.redirect('/setup');
  } catch (e) {}
  res.render('login', {
    title: 'Login',
    error: null,
    csrfToken: req.csrfToken()
  });
}

/**
 * Handle login
 */
async function login(req, res) {
  const { username, password } = req.body;

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.render('login', {
        title: 'Login',
        error: 'Invalid username or password',
        csrfToken: req.csrfToken()
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.render('login', {
        title: 'Login',
        error: 'Invalid username or password',
        csrfToken: req.csrfToken()
      });
    }

    // Set session
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    await auditService.log(user.id, 'LOGIN', null, req.ip);
    res.redirect('/admin');

  } catch (err) {
    console.error('Login error:', err);
    res.render('login', {
      title: 'Login',
      error: 'An error occurred. Please try again.',
      csrfToken: req.csrfToken()
    });
  }
}

/**
 * Show one-time setup page (only when no users exist)
 */
async function showSetup(req, res) {
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM users');
    if (rows[0].count > 0) {
      return res.redirect('/login');
    }
    res.render('setup', {
      title: 'Initial Setup',
      error: null,
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    console.error('Setup page error:', err);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load setup page.',
      user: null
    });
  }
}

/**
 * Handle one-time setup (create superadmin)
 */
async function handleSetup(req, res) {
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM users');
    if (rows[0].count > 0) {
      return res.redirect('/login');
    }

    const { username, password, confirmPassword } = req.body;

    if (!username || !password) {
      return res.render('setup', {
        title: 'Initial Setup',
        error: 'Username and password are required.',
        csrfToken: req.csrfToken()
      });
    }

    if (password.length < 6) {
      return res.render('setup', {
        title: 'Initial Setup',
        error: 'Password must be at least 6 characters.',
        csrfToken: req.csrfToken()
      });
    }

    if (password !== confirmPassword) {
      return res.render('setup', {
        title: 'Initial Setup',
        error: 'Passwords do not match.',
        csrfToken: req.csrfToken()
      });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.execute(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [username.trim(), hash, 'SUPER_ADMIN']
    );

    // Auto-login
    const [newUser] = await pool.execute('SELECT * FROM users WHERE username = ?', [username.trim()]);
    req.session.user = {
      id: newUser[0].id,
      username: newUser[0].username,
      role: newUser[0].role
    };

    res.redirect('/admin');
  } catch (err) {
    console.error('Setup error:', err);
    res.render('setup', {
      title: 'Initial Setup',
      error: 'Failed to create account: ' + err.message,
      csrfToken: req.csrfToken()
    });
  }
}

/**
 * Handle logout
 */
async function logout(req, res) {
  if (req.session && req.session.user) {
    await auditService.log(req.session.user.id, 'LOGOUT', null, req.ip);
  }
  req.session.destroy(() => {
    res.redirect('/login');
  });
}

module.exports = { showLogin, login, logout, showSetup, handleSetup };
