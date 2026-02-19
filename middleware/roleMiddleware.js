/**
 * Role middleware - require specific role(s)
 * @param  {...string} roles - Allowed roles (SUPER_ADMIN, ADMIN, STAFF)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to perform this action.',
        user: req.session.user
      });
    }
    next();
  };
}

module.exports = { requireRole };
