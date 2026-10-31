const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/staff_tracker',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_development_secret_only_change_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_key',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  
  DEFAULT_WORK_SHIFT_START: process.env.DEFAULT_WORK_SHIFT_START || '09:00',
  DEFAULT_WORK_SHIFT_END: process.env.DEFAULT_WORK_SHIFT_END || '18:00',
  DEFAULT_GRACE_MINUTES: parseInt(process.env.DEFAULT_GRACE_MINUTES, 10) || 15,
  DEFAULT_PER_KM_RATE: parseFloat(process.env.DEFAULT_PER_KM_RATE) || 6.5,
  DEFAULT_HALF_DAY_HOURS: parseFloat(process.env.DEFAULT_HALF_DAY_HOURS) || 4.5,
  DEFAULT_FULL_DAY_HOURS: parseFloat(process.env.DEFAULT_FULL_DAY_HOURS) || 8.0,

  GPS_ACCURACY_THRESHOLD_METERS: parseFloat(process.env.GPS_ACCURACY_THRESHOLD_METERS) || 40,
  MAX_TRAVEL_SPEED_KMH: parseFloat(process.env.MAX_TRAVEL_SPEED_KMH) || 130,
  MIN_TRAVEL_DISPLACEMENT_METERS: parseFloat(process.env.MIN_TRAVEL_DISPLACEMENT_METERS) || 10,

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 500,
};
