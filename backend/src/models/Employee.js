const mongoose = require('mongoose');
const { ACCOUNT_STATUS } = require('../constants');

const employeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
    },
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      index: true,
    },
    mobileNumber: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      index: true,
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
      index: true,
    },
    joiningDate: {
      type: Date,
      required: [true, 'Joining date is required'],
      default: Date.now,
    },
    accountStatus: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.ACTIVE,
      index: true,
    },
    baseSalary: {
      type: Number,
      required: [true, 'Base salary is required'],
      min: [0, 'Base salary cannot be negative'],
      default: 0,
    },
    dailyWage: {
      type: Number,
      min: [0, 'Daily wage cannot be negative'],
      default: 0,
    },
    perKmRate: {
      type: Number,
      required: [true, 'Per KM travel allowance rate is required'],
      min: [0, 'Per KM rate cannot be negative'],
      default: 6.5,
    },
    overtimeHourlyRate: {
      type: Number,
      min: [0, 'Overtime rate cannot be negative'],
      default: 0,
    },
    clusterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cluster',
      default: null,
      index: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    deviceInfo: {
      deviceId: { type: String, default: null },
      manufacturer: { type: String, default: null },
      model: { type: String, default: null },
      osVersion: { type: String, default: null },
      appVersion: { type: String, default: null },
      lastActiveAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

employeeSchema.index({ fullName: 'text', employeeId: 'text', department: 'text' });

const Employee = mongoose.model('Employee', employeeSchema);
module.exports = Employee;
