const mongoose = require("mongoose");

const breakSchema = new mongoose.Schema(
  {
    startTime: Date,
    endTime: Date,
    duration: Number, // in minutes
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Employee or Intern
      required: true,
    },

    userType: {
      type: String,
      enum: ["employee", "intern"],
      required: true,
    },

    date: {
      type: String, // "2026-06-04"
      required: true,
    },

    checkInTime: Date,
    checkOutTime: Date,

    breaks: [breakSchema],

    totalBreakTime: {
      type: Number,
      default: 0, // minutes
    },

    totalWorkTime: { 
      type: Number,
      default: 0, // minutes
    },

    isLate: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["present", "absent"],
      default: "absent",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Attendance", attendanceSchema);