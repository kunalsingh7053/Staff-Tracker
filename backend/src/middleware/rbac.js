const { ROLES } = require('../constants');

/**
 * Enforces role-based permissions
 * @param  {...string} roles Allowed roles (ADMIN, CLUSTER_MANAGER, STAFF)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not possess the required permissions.',
      });
    }
    next();
  };
};

/**
 * Checks if the user is authorized to manage/view a specific cluster
 * @param {Object} user Authenticated user
 * @param {string|ObjectId} clusterId Target cluster ID
 * @returns {boolean}
 */
const hasClusterAccess = (user, clusterId) => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.CLUSTER_MANAGER) {
    if (!clusterId || !user.assignedClusterIds || user.assignedClusterIds.length === 0) {
      return false;
    }
    const targetIdStr = clusterId.toString();
    return user.assignedClusterIds.some((id) => id.toString() === targetIdStr);
  }
  return false;
};

/**
 * Builds MongoDB filter query based on user role and assigned clusters
 * @param {Object} req Express request
 * @returns {Object} MongoDB query filter object
 */
const getClusterScopeFilter = (req) => {
  const { user } = req;
  const requestedClusterId = req.query.clusterId || req.body.clusterId;

  if (user.role === ROLES.ADMIN) {
    // Admin can view all clusters, or filter by specific cluster if provided
    return requestedClusterId ? { clusterId: requestedClusterId } : {};
  }

  if (user.role === ROLES.CLUSTER_MANAGER) {
    const assignedIds = user.assignedClusterIds || [];
    if (assignedIds.length === 0) {
      // Manager has no clusters assigned yet
      return { _id: null }; // Will match nothing safely
    }

    if (requestedClusterId) {
      const isAllowed = assignedIds.some((id) => id.toString() === requestedClusterId.toString());
      if (!isAllowed) {
        const error = new Error('Forbidden: You are not authorized to access this cluster.');
        error.statusCode = 403;
        throw error;
      }
      return { clusterId: requestedClusterId };
    }

    // Default to all clusters assigned to this manager
    return { clusterId: { $in: assignedIds } };
  }

  if (user.role === ROLES.STAFF) {
    // Staff can only view their own data
    return { employeeId: user.employeeId };
  }

  return { _id: null };
};

module.exports = {
  authorize,
  hasClusterAccess,
  getClusterScopeFilter,
};
