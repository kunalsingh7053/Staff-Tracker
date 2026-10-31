const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      default: 'K.K. GROUP',
      trim: true,
    },
    workShiftStart: {
      type: String, // "HH:mm" 24h
      required: true,
      default: '09:00',
    },
    workShiftEnd: {
      type: String, // "HH:mm" 24h
      required: true,
      default: '18:00',
    },
    graceMinutes: {
      type: Number,
      required: true,
      default: 15,
      min: 0,
    },
    halfDayThresholdHours: {
      type: Number,
      required: true,
      default: 4.5,
      min: 1,
    },
    fullDayThresholdHours: {
      type: Number,
      required: true,
      default: 8.0,
      min: 2,
    },
    defaultPerKmRate: {
      type: Number,
      required: true,
      default: 6.5,
      min: 0,
    },
    gpsAccuracyThresholdMeters: {
      type: Number,
      required: true,
      default: 40,
      min: 5,
    },
    maxTravelSpeedKmh: {
      type: Number,
      required: true,
      default: 130,
      min: 20,
    },
    holidays: [
      {
        date: { type: String, required: true }, // "YYYY-MM-DD"
        title: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const CompanySettings = mongoose.model('CompanySettings', companySettingsSchema);
module.exports = CompanySettings;
