const { Cluster, User, Employee, AuditLog } = require('../models');
const { ROLES } = require('../constants');
const { hasClusterAccess } = require('../middleware/rbac');

exports.createCluster = async (req, res, next) => {
  try {
    const { name, code, description, city, state, geofenceCenter, radiusMeters, managerIds } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Cluster name and code are required.',
      });
    }

    const existingName = await Cluster.findOne({ name: name.trim() });
    if (existingName) {
      return res.status(400).json({
        success: false,
        message: `Cluster with name "${name}" already exists.`,
      });
    }

    const existingCode = await Cluster.findOne({ code: code.trim().toUpperCase() });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `Cluster code "${code}" is already in use.`,
      });
    }

    const cluster = new Cluster({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description || '',
      city: city || null,
      state: state || null,
      geofenceCenter: geofenceCenter || null,
      radiusMeters: radiusMeters || 5000,
      managerIds: managerIds || [],
      createdBy: req.user._id,
    });

    await cluster.save();

    // If initial managerIds provided, update their assignedClusterIds in User collection
    if (managerIds && managerIds.length > 0) {
      await User.updateMany(
        { _id: { $in: managerIds } },
        { $addToSet: { assignedClusterIds: cluster._id } }
      );
    }

    await AuditLog.create({
      actorUserId: req.user._id,
      actorRole: req.user.role,
      action: 'CLUSTER_CREATED',
      entity: 'Cluster',
      entityId: cluster._id.toString(),
      newState: cluster.toObject(),
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Cluster created successfully.',
      data: cluster,
    });
  } catch (error) {
    next(error);
  }
};

exports.getClusters = async (req, res, next) => {
  try {
    let query = { isActive: true };

    if (req.user.role === ROLES.CLUSTER_MANAGER) {
      query._id = { $in: req.user.assignedClusterIds || [] };
    }

    const clusters = await Cluster.find(query)
      .populate('managerIds', 'employeeId email role')
      .sort({ name: 1 })
      .lean();

    // Enrich clusters with employee count
    const clusterIds = clusters.map((c) => c._id);
    const employeeCounts = await Employee.aggregate([
      { $match: { clusterId: { $in: clusterIds }, accountStatus: 'ACTIVE' } },
      { $group: { _id: '$clusterId', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    employeeCounts.forEach((ec) => {
      countMap[ec._id.toString()] = ec.count;
    });

    const enrichedClusters = clusters.map((c) => ({
      ...c,
      employeeCount: countMap[c._id.toString()] || 0,
      managerCount: c.managerIds ? c.managerIds.length : 0,
    }));

    return res.status(200).json({
      success: true,
      data: enrichedClusters,
    });
  } catch (error) {
    next(error);
  }
};

exports.getClusterById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!hasClusterAccess(req.user, id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this cluster.',
      });
    }

    const cluster = await Cluster.findById(id)
      .populate('managerIds', 'employeeId email')
      .lean();

    if (!cluster) {
      return res.status(404).json({
        success: false,
        message: 'Cluster not found.',
      });
    }

    const employees = await Employee.find({ clusterId: cluster._id, accountStatus: 'ACTIVE' })
      .select('employeeId fullName designation department mobileNumber perKmRate')
      .sort({ fullName: 1 });

    return res.status(200).json({
      success: true,
      data: {
        ...cluster,
        employees,
        employeeCount: employees.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCluster = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, city, state, geofenceCenter, radiusMeters, isActive } = req.body;

    const cluster = await Cluster.findById(id);
    if (!cluster) {
      return res.status(404).json({
        success: false,
        message: 'Cluster not found.',
      });
    }

    const previousState = cluster.toObject();

    if (name) cluster.name = name.trim();
    if (description !== undefined) cluster.description = description;
    if (city !== undefined) cluster.city = city;
    if (state !== undefined) cluster.state = state;
    if (geofenceCenter) cluster.geofenceCenter = geofenceCenter;
    if (radiusMeters) cluster.radiusMeters = radiusMeters;
    if (isActive !== undefined) cluster.isActive = isActive;

    await cluster.save();

    await AuditLog.create({
      actorUserId: req.user._id,
      actorRole: req.user.role,
      action: 'CLUSTER_UPDATED',
      entity: 'Cluster',
      entityId: cluster._id.toString(),
      previousState,
      newState: cluster.toObject(),
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Cluster updated successfully.',
      data: cluster,
    });
  } catch (error) {
    next(error);
  }
};

exports.assignManagers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { managerIds } = req.body; // Array of user IDs

    if (!Array.isArray(managerIds) || managerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of manager user IDs.',
      });
    }

    const cluster = await Cluster.findById(id);
    if (!cluster) {
      return res.status(404).json({
        success: false,
        message: 'Cluster not found.',
      });
    }

    // Verify all specified users have role CLUSTER_MANAGER
    const validManagers = await User.find({
      _id: { $in: managerIds },
      role: ROLES.CLUSTER_MANAGER,
    });

    if (validManagers.length !== managerIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected users do not have the CLUSTER_MANAGER role.',
      });
    }

    // Add to cluster.managerIds (unique set)
    const existingStr = cluster.managerIds.map((m) => m.toString());
    managerIds.forEach((mId) => {
      if (!existingStr.includes(mId.toString())) {
        cluster.managerIds.push(mId);
      }
    });
    await cluster.save();

    // Add cluster to users' assignedClusterIds
    await User.updateMany(
      { _id: { $in: managerIds } },
      { $addToSet: { assignedClusterIds: cluster._id } }
    );

    return res.status(200).json({
      success: true,
      message: 'Cluster managers assigned successfully.',
      data: cluster,
    });
  } catch (error) {
    next(error);
  }
};

exports.removeManager = async (req, res, next) => {
  try {
    const { id, managerId } = req.params;

    const cluster = await Cluster.findById(id);
    if (!cluster) {
      return res.status(404).json({
        success: false,
        message: 'Cluster not found.',
      });
    }

    cluster.managerIds = cluster.managerIds.filter((m) => m.toString() !== managerId.toString());
    await cluster.save();

    // Pull from user's assignedClusterIds
    await User.findByIdAndUpdate(managerId, {
      $pull: { assignedClusterIds: cluster._id },
    });

    return res.status(200).json({
      success: true,
      message: 'Manager unassigned from cluster successfully.',
      data: cluster,
    });
  } catch (error) {
    next(error);
  }
};

exports.transferEmployee = async (req, res, next) => {
  try {
    const { employeeId, targetClusterId, newManagerId } = req.body;

    if (!employeeId || !targetClusterId) {
      return res.status(400).json({
        success: false,
        message: 'Both employeeId and targetClusterId are required.',
      });
    }

    const employee = await Employee.findOne({ employeeId: employeeId.trim().toUpperCase() });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: `Employee ${employeeId} not found.`,
      });
    }

    const targetCluster = await Cluster.findById(targetClusterId);
    if (!targetCluster) {
      return res.status(404).json({
        success: false,
        message: 'Target cluster not found.',
      });
    }

    const previousClusterId = employee.clusterId;
    employee.clusterId = targetCluster._id;
    if (newManagerId) {
      employee.managerId = newManagerId;
    }
    await employee.save();

    await AuditLog.create({
      actorUserId: req.user._id,
      actorRole: req.user.role,
      action: 'EMPLOYEE_TRANSFERRED',
      entity: 'Employee',
      entityId: employee.employeeId,
      previousState: { clusterId: previousClusterId },
      newState: { clusterId: targetCluster._id, clusterName: targetCluster.name },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: `Employee ${employee.fullName} (${employee.employeeId}) successfully transferred to cluster ${targetCluster.name}.`,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};

exports.getClusterManagersList = async (req, res, next) => {
  try {
    const managers = await User.find({ role: ROLES.CLUSTER_MANAGER, isActive: true })
      .select('employeeId email assignedClusterIds createdAt')
      .populate('assignedClusterIds', 'name code')
      .sort({ employeeId: 1 });

    return res.status(200).json({
      success: true,
      data: managers,
    });
  } catch (error) {
    next(error);
  }
};
