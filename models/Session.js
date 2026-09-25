const mongoose = require("mongoose");
const crypto = require("crypto");

const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      default: null,
    },

    startTime: {
      type: Date,
      default: Date.now,
    },

    endTime: {
      type: Date,
      default: null,
    },

    lastActiveTime: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["active", "break", "terminated", "auto_checkout"],
      default: "active",
    },

    deviceInfo: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Session = mongoose.models.Session || mongoose.model("Session", sessionSchema);

module.exports = Session;
