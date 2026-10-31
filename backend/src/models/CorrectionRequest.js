const mongoose = require('mongoose');
const { CORRECTION_STATUS } = require('../constants');

const correctionRequestSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      required: [true, 'Associated attendance record ID is required'],
      index: true,
    },
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
    requestedCheckIn: {
      type: Date,
      default: null,
    },
    requestedCheckOut: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      required: [true, 'Reason for correction request is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(CORRECTION_STATUS),
      default: CORRECTION_STATUS.PENDING,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewRemarks: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

correctionRequestSchema.index({ employeeId: 1, createdAt: -1 });

const CorrectionRequest = mongoose.model('CorrectionRequest', correctionRequestSchema);
module.exports = CorrectionRequest;
