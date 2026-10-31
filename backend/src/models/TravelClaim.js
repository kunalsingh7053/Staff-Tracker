const mongoose = require('mongoose');
const { CLAIM_STATUS } = require('../constants');

const travelClaimSchema = new mongoose.Schema(
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
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TravelSession',
      default: null,
      index: true,
    },
    claimDate: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Claim date is required'],
      index: true,
    },
    claimedDistanceKm: {
      type: Number,
      required: [true, 'Claimed distance is required'],
      min: [0, 'Claimed distance cannot be negative'],
    },
    claimedAmount: {
      type: Number,
      required: [true, 'Claimed monetary amount is required'],
      min: [0, 'Claimed amount cannot be negative'],
    },
    tollAndParkingAmount: {
      type: Number,
      default: 0,
      min: [0, 'Toll and parking amount cannot be negative'],
    },
    receiptUrls: {
      type: [String],
      default: [],
    },
    remarks: {
      type: String,
      required: [true, 'Remarks/reason is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(CLAIM_STATUS),
      default: CLAIM_STATUS.PENDING,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewNotes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

travelClaimSchema.index({ employeeId: 1, claimDate: -1 });

const TravelClaim = mongoose.model('TravelClaim', travelClaimSchema);
module.exports = TravelClaim;
