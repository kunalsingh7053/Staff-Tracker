const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salaryController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../constants');

router.use(authenticate);

// Admin batch calculation
router.post('/generate', authorize(ROLES.ADMIN), salaryController.generateMonthlySalary);

// Salary records: Admin & Cluster Manager
router.get('/', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), salaryController.getSalaryRecords);

// Staff self salary slips
router.get('/my-slips', authorize(ROLES.STAFF), salaryController.getMySlips);

// Travel Claims workflow
router.post('/claims', authorize(ROLES.STAFF), salaryController.submitClaim);
router.get('/claims', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER, ROLES.STAFF), salaryController.getClaims);
router.put('/claims/:id', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), salaryController.reviewClaim);

module.exports = router;
