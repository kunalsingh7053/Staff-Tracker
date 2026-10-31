const mongoose = require('mongoose');
const { SALARY_STATUS } = require('../constants');

const salaryRecordSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    clusterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cluster',
      default: null,
      index: true,
    },
    monthYear: {
      type: String, // 'YYYY-MM'
      required: [true, 'Payroll month-year (YYYY-MM) is required'],
      index: true,
    },
    baseSalary: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalWorkingDays: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    presentDays: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    halfDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    absentDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidLeaves: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDistanceKm: {
      type: Number,
      default: 0,
      min: 0,
    },
    perKmRate: {
      type: Number,
      required: true,
      default: 6.5,
      min: 0,
    },
    travelAllowanceAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    overtimeHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    overtimePay: {
      type: Number,
      default: 0,
      min: 0,
    },
    grossEarnings: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    deductions: {
      type: Number,
      default: 0,
      min: 0,
    },
    netPayable: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(SALARY_STATUS),
      default: SALARY_STATUS.DRAFT,
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

salaryRecordSchema.index({ employeeId: 1, monthYear: 1 }, { unique: true });

const SalaryRecord = mongoose.model('SalaryRecord', salaryRecordSchema);
module.exports = SalaryRecord;
