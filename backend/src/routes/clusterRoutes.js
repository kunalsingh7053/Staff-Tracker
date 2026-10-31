const express = require('express');
const router = express.Router();
const clusterController = require('../controllers/clusterController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../constants');

router.use(authenticate);

// Cluster listings: Admin sees all; Cluster Manager sees assigned clusters
router.get('/', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), clusterController.getClusters);
router.get('/managers/list', authorize(ROLES.ADMIN), clusterController.getClusterManagersList);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), clusterController.getClusterById);

// Admin-only operations
router.post('/', authorize(ROLES.ADMIN), clusterController.createCluster);
router.put('/:id', authorize(ROLES.ADMIN), clusterController.updateCluster);
router.post('/:id/managers', authorize(ROLES.ADMIN), clusterController.assignManagers);
router.delete('/:id/managers/:managerId', authorize(ROLES.ADMIN), clusterController.removeManager);
router.post('/transfer-employee', authorize(ROLES.ADMIN), clusterController.transferEmployee);

module.exports = router;
