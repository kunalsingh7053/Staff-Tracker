const mongoose = require('mongoose');

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

const locationPointSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TravelSession',
      required: [true, 'Session ID reference is required'],
      index: true,
    },
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    location: {
      type: pointSchema,
      required: [true, 'Location coordinate is required'],
    },
    altitude: {
      type: Number,
      default: 0,
    },
    accuracy: {
      type: Number,
      required: [true, 'GPS accuracy in meters is required'],
      min: 0,
    },
    speed: {
      type: Number, // Speed in m/s
      default: 0,
      min: 0,
    },
    bearing: {
      type: Number, // Degrees (0-360)
      default: 0,
    },
    timestamp: {
      type: Date,
      required: [true, 'GPS fix timestamp is required'],
      index: true,
    },
    isFiltered: {
      type: Boolean,
      default: false,
      index: true,
    },
    filterReason: {
      type: String,
      default: null,
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    isCharging: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

locationPointSchema.index({ sessionId: 1, timestamp: 1 });
locationPointSchema.index({ 'location.coordinates': '2dsphere' });

const LocationPoint = mongoose.model('LocationPoint', locationPointSchema);
module.exports = LocationPoint;
