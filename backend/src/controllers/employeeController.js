const { User, Employee, Cluster, AuditLog } = require('../models');
const { ROLES, ACCOUNT_STATUS } = require('../constants');
const { hasClusterAccess } = require('../middleware/rbac');

// Helper to auto-generate unique sequential employee ID
const generateNextEmployeeId = async (prefix = 'KK-EMP') => {
  const latest = await User.findOne({ employeeId: new RegExp(`^${prefix}-\\d+$`) })
    .sort({ employeeId: -1 })
    .select('employeeId');

  if (!latest) {
    return `${prefix}-1001`;
  }

  const parts = latest.employeeId.split('-');
  const seq = parseInt(parts[parts.length - 1], 10);
  const nextSeq = isNaN(seq) ? 1001 : seq + 1;
  return `${prefix}-${nextSeq}`;
};

exports.createEmployee = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      password,
      mobileNumber,
      department,
      designation,
      role = ROLES.STAFF,
      clusterId,
      managerId,
      baseSalary = 25000,
      dailyWage = 0,
      perKmRate = 6.5,
      overtimeHourlyRate = 0,
    } = req.body;

    if (!fullName || !email || !password || !mobileNumber || !department || !designation) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, password, mobile number, department, and designation are required.',
      });
    }

    // Role-based cluster authorization check
    if (req.user.role === ROLES.CLUSTER_MANAGER) {
      if (!clusterId || !hasClusterAccess(req.user, clusterId)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only create employees within your assigned cluster(s).',
        });
      }
    }

    // Check duplicate email
    const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Check duplicate mobile
    const existingMobile = await Employee.findOne({ mobileNumber: mobileNumber.trim() });
    if (existingMobile) {
      return res.status(400).json({
        success: false,
        message: 'An employee with this mobile number already exists.',
      });
    }

    // Generate unique employee ID
    const prefix = role === ROLES.CLUSTER_MANAGER ? 'KK-MGR' : 'KK-EMP';
    const employeeId = await generateNextEmployeeId(prefix);

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create User
    const user = new User({
      employeeId,
      email: email.trim().toLowerCase(),
      passwordHash,
      role,
      assignedClusterIds: role === ROLES.CLUSTER_MANAGER && clusterId ? [clusterId] : [],
    });
    await user.save();

    // Create Employee record
    const employee = new Employee({
      userId: user._id,
      employeeId,
      fullName: fullName.trim(),
      mobileNumber: mobileNumber.trim(),
      department: department.trim(),
      designation: designation.trim(),
      clusterId: clusterId || null,
      managerId: managerId || (req.user.role === ROLES.CLUSTER_MANAGER ? req.user._id : null),
      baseSalary,
      dailyWage,
      perKmRate,
      overtimeHourlyRate,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
    });
    await employee.save();

    // If manager role and cluster assigned, link user to cluster.managerIds
    if (role === ROLES.CLUSTER_MANAGER && clusterId) {
      await Cluster.findByIdAndUpdate(clusterId, { $addToSet: { managerIds: user._id } });
    }

    await AuditLog.create({
      actorUserId: req.user._id,
      actorRole: req.user.role,
      action: 'EMPLOYEE_CREATED',
      entity: 'Employee',
      entityId: employeeId,
      newState: employee.toObject(),
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: `Employee ${fullName} created successfully with ID ${employeeId}.`,
      data: {
        employee,
        user: {
          id: user._id,
          employeeId: user.employeeId,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getEmployees = async (req, res, next) => {
  try {
    const { clusterId, department, status, search, page = 1, limit = 50 } = req.query;
    let filter = {};

    // 3-Level Scope Enforcement:
    if (req.user.role === ROLES.ADMIN) {
      if (clusterId) {
        filter.clusterId = clusterId;
      }
    } else if (req.user.role === ROLES.CLUSTER_MANAGER) {
      const allowedClusters = req.user.assignedClusterIds || [];
      if (allowedClusters.length === 0) {
        return res.status(200).json({ success: true, data: [], total: 0 });
      }

      if (clusterId) {
        if (!hasClusterAccess(req.user, clusterId)) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You cannot access employees from this cluster.',
          });
        }
        filter.clusterId = clusterId;
      } else {
        filter.clusterId = { $in: allowedClusters };
      }
    } else {
      // Staff cannot query employee list
      return res.status(403).json({
        success: false,
        message: 'Access denied: Staff members cannot list employees.',
      });
    }

    if (department) filter.department = department;
    if (status) filter.accountStatus = status;

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Employee.countDocuments(filter);
    const employees = await Employee.find(filter)
      .populate('clusterId', 'name code city')
      .populate('managerId', 'employeeId email')
      .populate('userId', 'email role isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    return res.status(200).json({
      success: true,
      data: employees,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getEmployeeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let employee = null;
    if (id.startsWith('KK-')) {
      employee = await Employee.findOne({ employeeId: id.toUpperCase() })
        .populate('clusterId', 'name code city state')
        .populate('managerId', 'employeeId email')
        .populate('userId', 'email role isActive lastLoginAt');
    } else {
      employee = await Employee.findById(id)
        .populate('clusterId', 'name code city state')
        .populate('managerId', 'employeeId email')
        .populate('userId', 'email role isActive lastLoginAt');
    }

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    // Role-based boundary enforcement
    if (req.user.role === ROLES.STAFF) {
      if (employee.employeeId !== req.user.employeeId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view your own profile.',
        });
      }
    } else if (req.user.role === ROLES.CLUSTER_MANAGER) {
      if (!employee.clusterId || !hasClusterAccess(req.user, employee.clusterId._id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: This employee does not belong to your assigned cluster(s).',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      mobileNumber,
      department,
      designation,
      baseSalary,
      dailyWage,
      perKmRate,
      overtimeHourlyRate,
      accountStatus,
      clusterId,
      managerId,
    } = req.body;

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    // Permission enforcement: Cluster Manager can only update their own cluster employees
    if (req.user.role === ROLES.CLUSTER_MANAGER) {
      if (!employee.clusterId || !hasClusterAccess(req.user, employee.clusterId)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You cannot modify employees from other clusters.',
        });
      }
      // Cluster Manager cannot transfer clusters or modify base salary
      if (clusterId && clusterId.toString() !== employee.clusterId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Only administrators can transfer employees between clusters.',
        });
      }
    }

    const previousState = employee.toObject();

    if (fullName) employee.fullName = fullName.trim();
    if (mobileNumber) employee.mobileNumber = mobileNumber.trim();
    if (department) employee.department = department.trim();
    if (designation) employee.designation = designation.trim();

    if (req.user.role === ROLES.ADMIN) {
      if (baseSalary !== undefined) employee.baseSalary = baseSalary;
      if (dailyWage !== undefined) employee.dailyWage = dailyWage;
      if (perKmRate !== undefined) employee.perKmRate = perKmRate;
      if (overtimeHourlyRate !== undefined) employee.overtimeHourlyRate = overtimeHourlyRate;
      if (accountStatus) employee.accountStatus = accountStatus;
      if (clusterId) employee.clusterId = clusterId;
      if (managerId !== undefined) employee.managerId = managerId;
    }

    await employee.save();

    await AuditLog.create({
      actorUserId: req.user._id,
      actorRole: req.user.role,
      action: 'EMPLOYEE_UPDATED',
      entity: 'Employee',
      entityId: employee.employeeId,
      previousState,
      newState: employee.toObject(),
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Employee updated successfully.',
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};
