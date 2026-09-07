const mongoose = require("mongoose");

const breakSchema = new mongoose.Schema(
  {
    startTime: {
      type: Date,
      required: true,
    },
 
    endTime: {
      type: Date, 
      default: null,
    },

    duration: {
      type: Number,
      default: 0, // Minutes
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
      enum: ["employee", "intern", "team lead", "hr", "admin"],
      required: true,
    }, 

    date: {
      type: String,
      required: true,
    },

    checkInTime: Date, 

    checkOutTime: Date,

    breaks: [breakSchema],

    totalBreakTime: {
      type: Number,
      default: 0, // Minutes
    },

    totalWorkTime: {
      type: Number,
      default: 0, // Hours
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

    rejectionReason: {
  type: String,
  default: null,
  trim: true,
},

    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: Date,

    approvedCheckInTime: Date,

    sessionId: {
      type: String,
      default: null,
    },

    halfDayType: {
      type: String,
      enum: ["first-half", "second-half", null],
      default: null,
    },

      officeStartTime: String,

      lateCutoffTime: String,

      absentCutoffTime: String,

      officeEndTime: String,

      presentHours: Number,

      halfDayHours: Number,

      breakLimit: Number,

    isActiveSession: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// One attendance per user per day
attendanceSchema.index(
  { userId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "Attendance",
  attendanceSchema
);