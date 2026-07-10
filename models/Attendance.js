const mongoose = require("mongoose");

const breakSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      default: null,
    },

    duration: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    userType: {
      type: String,
      enum: ["employee", "intern"],
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    // IST Time String
    checkInTime: {
      type: String,
      default: null,
    },

    checkOutTime: {
      type: String,
      default: null,
    },

    breaks: [breakSchema],

    totalBreakTime: {
      type: Number,
      default: 0,
    },

    totalWorkTime: {
      type: Number,
      default: 0,
    },

    isLate: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: [
        "present",
        "half-day",
        "absent",
        "leave",
      ],
      default: "present",
    },

    approvalStatus: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
      ],
      default: "pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: String,
      default: null,
    },

    approvedCheckInTime: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One attendance per user per day
attendanceSchema.index(
  {
    userId: 1,
    date: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "Attendance",
  attendanceSchema
);