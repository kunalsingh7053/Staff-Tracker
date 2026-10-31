const mongoose = require('mongoose');
const { TRAVEL_SESSION_STATUS } = require('../constants');

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
  },
  { _id: false }
);

const travelSessionSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      required: true,
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
    sessionStatus: {
      type: String,
      enum: Object.values(TRAVEL_SESSION_STATUS),
      default: TRAVEL_SESSION_STATUS.IN_PROGRESS,
      index: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
      default: Date.now,
      index: true,
    },
    endTime: {
      type: Date,
      default: null,
      index: true,
    },
    startLocation: {
      type: pointSchema,
      required: [true, 'Start location is required'],
    },
    endLocation: {
      type: pointSchema,
      default: null,
    },
    totalDistanceKm: {
      type: Number,
      default: 0,
      min: [0, 'Total distance cannot be negative'],
    },
    totalDurationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPointsCount: {
      type: Number,
      default: 0,
    },
    averageSpeedKmh: {
      type: Number,
      default: 0,
    },
    maxSpeedKmh: {
      type: Number,
      default: 0,
    },
    purpose: {
      type: String,
      default: 'Field Duty',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

travelSessionSchema.index({ employeeId: 1, startTime: -1 });
travelSessionSchema.index({ 'startLocation.coordinates': '2dsphere' });
travelSessionSchema.index({ 'endLocation.coordinates': '2dsphere' });

const TravelSession = mongoose.model('TravelSession', travelSessionSchema);
module.exports = TravelSession;
