const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimitMiddleware');

router.get('/login', authController.showLogin);
router.post('/login', loginLimiter, authController.login);
router.get('/logout', authController.logout);

module.exports = router;
