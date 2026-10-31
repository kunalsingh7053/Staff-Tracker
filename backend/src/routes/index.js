const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const clusterRoutes = require('./clusterRoutes');
const employeeRoutes = require('./employeeRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const travelRoutes = require('./travelRoutes');
const salaryRoutes = require('./salaryRoutes');
const reportRoutes = require('./reportRoutes');

router.use('/auth', authRoutes);
router.use('/clusters', clusterRoutes);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/travel', travelRoutes);
router.use('/salary', salaryRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
