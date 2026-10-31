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

const clusterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Cluster name is required'],
      unique: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Cluster code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    managerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    city: {
      type: String,
      default: null,
      trim: true,
    },
    state: {
      type: String,
      default: null,
      trim: true,
    },
    geofenceCenter: {
      type: pointSchema,
      default: null,
    },
    radiusMeters: {
      type: Number,
      default: 5000,
      min: [100, 'Radius must be at least 100 meters'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

clusterSchema.index({ name: 'text', code: 'text', city: 'text' });
if (clusterSchema.path('geofenceCenter')) {
  clusterSchema.index({ 'geofenceCenter.coordinates': '2dsphere' });
}

const Cluster = mongoose.model('Cluster', clusterSchema);
module.exports = Cluster;
