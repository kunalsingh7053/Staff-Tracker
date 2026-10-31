const mongoose = require('mongoose');
const { NOTIFICATION_TYPE } = require('../constants');

const notificationSchema = new mongoose.Schema(
  {
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient user reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    body: {
      type: String,
      required: [true, 'Notification message body is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      required: [true, 'Notification type is required'],
      index: true,
    },
    dataPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipientUserId: 1, isRead: 1, sentAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
