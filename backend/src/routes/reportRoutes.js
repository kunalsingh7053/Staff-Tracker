const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../constants');

router.use(authenticate);

// Admin & Cluster Manager dashboard summaries
router.get('/dashboard', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), reportController.getDashboardMetrics);

// Exporting reports
router.get('/export/excel', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), reportController.exportExcel);
router.get('/export/pdf', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), reportController.exportPdf);

module.exports = router;
