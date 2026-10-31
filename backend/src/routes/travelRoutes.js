const express = require('express');
const router = express.Router();
const travelController = require('../controllers/travelController');
const authenticate = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../constants');

router.use(authenticate);

// Staff travel session actions
router.post('/start', authorize(ROLES.STAFF), travelController.startTravel);
router.post('/location-batch', authorize(ROLES.STAFF), travelController.recordLocationBatch);
router.post('/stop', authorize(ROLES.STAFF), travelController.stopTravel);
router.get('/active', authorize(ROLES.STAFF), travelController.getActiveSession);

// Admin & Cluster Manager live fleet tracking
router.get('/live-fleet', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER), travelController.getLiveFleet);

// Single session route review (Admin, Cluster Manager, or Self Staff)
router.get('/session/:id', authorize(ROLES.ADMIN, ROLES.CLUSTER_MANAGER, ROLES.STAFF), travelController.getSessionById);

module.exports = router;
