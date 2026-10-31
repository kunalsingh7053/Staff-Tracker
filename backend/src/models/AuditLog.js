const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String, // e.g., 'EMPLOYEE_CREATED', 'ATTENDANCE_CORRECTED', 'CLAIM_APPROVED'
      required: [true, 'Audit action is required'],
      index: true,
    },
    entity: {
      type: String, // e.g., 'Employee', 'Attendance', 'TravelClaim'
      required: [true, 'Target entity is required'],
      index: true,
    },
    entityId: {
      type: String,
      required: [true, 'Target entity identifier is required'],
      index: true,
    },
    previousState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      immutable: true,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

auditLogSchema.index({ entity: 1, entityId: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
