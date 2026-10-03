const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null = system-wide notification
      index: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      default: "SYSTEM",
    },

    channel: {
      type: String,
      default: "IN_APP",
    },

    read: {
      type: Boolean,
      default: false,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    metaData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Synchronize read/isRead and meta/metaData before saving
notificationSchema.pre("save", function (next) {
  if (this.isModified("read") && !this.isModified("isRead")) {
    this.isRead = this.read;
  } else if (this.isModified("isRead") && !this.isModified("read")) {
    this.read = this.isRead;
  }
  if (this.read && !this.readAt) {
    this.readAt = new Date();
  }
  if (this.meta && (!this.metaData || Object.keys(this.metaData).length === 0)) {
    this.metaData = this.meta;
  } else if (this.metaData && (!this.meta || Object.keys(this.meta).length === 0)) {
    this.meta = this.metaData;
  }
  next();
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ companyId: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

module.exports = Notification;