const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, Employee } = require('../models');
const { ROLES } = require('../constants');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact your company administrator.',
      });
    }

    req.user = user;

    // If STAFF, attach their employee record
    if (user.role === ROLES.STAFF) {
      const employee = await Employee.findOne({ userId: user._id });
      req.employee = employee || null;
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please refresh your token.',
        isExpired: true,
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token.',
    });
  }
};

module.exports = authenticate;
