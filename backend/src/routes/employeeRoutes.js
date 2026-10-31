const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../constants');

router.use(authenticate);

// List employees (Admin & Cluster Manager)
router.get('/', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), employeeController.getEmployees);

// Create employee (Admin can create anywhere; Cluster Manager can create within assigned cluster)
router.post('/', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), employeeController.createEmployee);

// Get single employee (Admin, Cluster Manager, or Self Staff)
router.get('/:id', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER, ROLES.STAFF), employeeController.getEmployeeById);

// Update employee (Admin full edit, Cluster Manager partial edit for own cluster)
router.put('/:id', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), employeeController.updateEmployee);

module.exports = router;
