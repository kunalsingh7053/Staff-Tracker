const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, Employee, Cluster } = require('../models');
const { ROLES } = require('../constants');

const generateTokens = (user) => {
  const payload = {
    id: user._id,
    employeeId: user.employeeId,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
};

exports.login = async (req, res, next) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both employee ID/email and password.',
      });
    }

    const trimmedLogin = loginId.trim();
    // Allow login via uppercase employeeId OR lowercase email
    const user = await User.findOne({
      $or: [
        { employeeId: trimmedLogin.toUpperCase() },
        { email: trimmedLogin.toLowerCase() },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Employee ID/Email not found.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact your company administrator.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.',
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    user.lastLoginAt = new Date();
    await user.save();

    let employeeProfile = null;
    let clusterInfo = null;

    if (user.role === ROLES.STAFF) {
      employeeProfile = await Employee.findOne({ userId: user._id }).populate('clusterId', 'name code city');
      if (employeeProfile && employeeProfile.clusterId) {
        clusterInfo = employeeProfile.clusterId;
      }
    } else if (user.role === ROLES.CLUSTER_MANAGER) {
      clusterInfo = await Cluster.find({ _id: { $in: user.assignedClusterIds } }).select('name code city state');
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: user._id,
          employeeId: user.employeeId,
          email: user.email,
          role: user.role,
          assignedClusterIds: user.assignedClusterIds,
        },
        employee: employeeProfile,
        cluster: clusterInfo,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
    }

    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token or user account deactivated.',
      });
    }

    const tokens = generateTokens(user);
    return res.status(200).json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token.',
    });
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = req.user;
    let employee = null;
    let clusters = [];

    if (user.role === ROLES.STAFF) {
      employee = await Employee.findOne({ userId: user._id }).populate('clusterId', 'name code city');
    } else if (user.role === ROLES.CLUSTER_MANAGER) {
      clusters = await Cluster.find({ _id: { $in: user.assignedClusterIds } }).select('name code city state');
    } else if (user.role === ROLES.ADMIN) {
      clusters = await Cluster.find({ isActive: true }).select('name code city state');
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          employeeId: user.employeeId,
          email: user.email,
          role: user.role,
          assignedClusterIds: user.assignedClusterIds,
        },
        employee,
        clusters,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Both current password and new password are required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password does not match.',
      });
    }

    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    next(error);
  }
};
