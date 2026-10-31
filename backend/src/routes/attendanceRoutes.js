const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../constants');

router.use(authenticate);

// Staff check-in / check-out
router.post('/check-in', authorize(ROLES.STAFF), attendanceController.checkIn);
router.post('/check-out', authorize(ROLES.STAFF), attendanceController.checkOut);
router.get('/today', authorize(ROLES.STAFF), attendanceController.getTodayStatus);
router.get('/history', authorize(ROLES.STAFF), attendanceController.getMyHistory);

// Admin & Cluster Manager attendance monitoring
router.get('/monitor', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), attendanceController.getAttendanceMonitor);

// Corrections workflow
router.post('/correction', authorize(ROLES.STAFF), attendanceController.submitCorrection);
router.put('/correction/:id', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), attendanceController.reviewCorrection);

module.exports = router;
