const mongoose = require("mongoose");

const attendanceJobLogSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      required: true,
      default: "DAILY_ATTENDANCE_FINALIZATION",
      index: true,
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    targetDate: {
      type: Date,
      default: null,
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
    executionType: {
      type: String,
      enum: ["SCHEDULED", "CATCH_UP", "MANUAL", "PREVIEW"],
      default: "SCHEDULED",
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED", "SKIPPED", "PARTIAL"],
      default: "SUCCESS",
    },
    isHoliday: {
      type: Boolean,
      default: false,
    },
    isSunday: {
      type: Boolean,
      default: false,
    },
    reason: {
      type: String,
      default: "",
    },
    summary: {
      totalEligibleEmployees: { type: Number, default: 0 },
      checkedIn: { type: Number, default: 0 },
      markedAbsent: { type: Number, default: 0 },
      preservedLeaves: { type: Number, default: 0 },
      preservedHalfDayLeaves: { type: Number, default: 0 },
      pendingLeaves: { type: Number, default: 0 },
      approvedAdjustments: { type: Number, default: 0 },
      skippedFutureJoiners: { type: Number, default: 0 },
      skippedInactive: { type: Number, default: 0 },
      errors: { type: Array, default: [] },
    },
  },
  { timestamps: true }
);

attendanceJobLogSchema.index({ jobName: 1, date: 1 });

module.exports = mongoose.model("AttendanceJobLog", attendanceJobLogSchema);
