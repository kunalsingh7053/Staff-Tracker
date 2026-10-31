const mongoose = require('mongoose');
const { ATTENDANCE_STATUS } = require('../constants');

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clusterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cluster',
      default: null,
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Attendance date string (YYYY-MM-DD) is required'],
      index: true,
    },
    checkInTime: {
      type: Date,
      required: [true, 'Check-in time is required'],
      index: true,
    },
    checkInLocation: {
      type: pointSchema,
      required: [true, 'Check-in GPS location is required'],
    },
    checkInAddress: {
      type: String,
      default: null,
    },
    checkInDeviceId: {
      type: String,
      required: [true, 'Check-in device identifier is required'],
    },
    checkOutTime: {
      type: Date,
      default: null,
      index: true,
    },
    checkOutLocation: {
      type: pointSchema,
      default: null,
    },
    checkOutAddress: {
      type: String,
      default: null,
    },
    checkOutDeviceId: {
      type: String,
      default: null,
    },
    totalWorkingMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.PRESENT,
      index: true,
    },
    lateMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    overtimeMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    isOfflineSync: {
      type: Boolean,
      default: false,
    },
    offlineRecordedAt: {
      type: Date,
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

// Compound unique index ensuring one attendance record per employee per calendar date
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ 'checkInLocation.coordinates': '2dsphere' });
attendanceSchema.index({ 'checkOutLocation.coordinates': '2dsphere' });

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;
