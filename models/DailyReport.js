const mongoose = require("mongoose");

const parseHoursWorked = (val) => {
  if (val === undefined || val === null || val === "") return val;
  if (typeof val === "number") {
    return isNaN(val) ? val : Math.round(val * 100) / 100;
  }
  if (typeof val === "string") {
    const trimmed = val.trim().replace(",", ".");
    if (trimmed.includes(":")) {
      const parts = trimmed.split(":");
      const h = parseFloat(parts[0]) || 0;
      const m = parseFloat(parts[1]) || 0;
      return parseFloat(h + "." + (m < 10 ? "0" + m : m));
    }
    const num = parseFloat(trimmed);
    return isNaN(num) ? val : Math.round(num * 100) / 100;
  }
  return val;
}; 

const dailyReportSchema =
  new mongoose.Schema(
    { 
      employeeId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User", 
        required: true,
      },

      projectId: { 
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Project",
        default: null,
      },

      otherProjectName: {
        type: String,
        trim: true,
      },

      todaysWork: {
        type: String,
        required: true,
      },

      pendingWork: {
        type: String,
      },

      tomorrowPlan: {
        type: String,
      },

      issuesFaced: {
        type: String,
      },

      hoursWorked: {
        type: Number,
        required: true,
        min: 0,
        set: parseHoursWorked,
        get: (val) => {
          if (typeof val === "number" && !isNaN(val)) {
            return Math.round(val * 100) / 100;
          }
          return val;
        },
      },

      taskReferences: [
        {
          type:
            mongoose.Schema.Types.ObjectId,
          ref: "Task",
        },
      ],

      remarks: {
        type: String,
      },

      reviewedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      reviewedAt: {
        type: Date,
      },

      reportDate: {
        type: Date,
        default: Date.now,
      },
    },
    {
      timestamps: true,
      toJSON: { getters: true, virtuals: true },
      toObject: { getters: true, virtuals: true },
    }
  );

module.exports = mongoose.model(
  "DailyReport",
  dailyReportSchema
);