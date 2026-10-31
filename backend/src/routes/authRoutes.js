const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const seedController = require('../controllers/seedController');
const authenticate = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.get('/me', authenticate, authController.getMe);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/seed', seedController.seedDatabase);

module.exports = router;
