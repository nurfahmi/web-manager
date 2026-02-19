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

module.exports = { showLogin, login, logout };
