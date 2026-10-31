const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../constants');

const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.STAFF,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    fcmTokens: {
      type: [String],
      default: [],
    },
    refreshTokenHash: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    assignedClusterIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cluster',
        index: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.passwordHash);
};

userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
};

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.refreshTokenHash;
  return user;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
