const mongoose = require("mongoose");

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
        required: true,
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
      },

      taskReferences: [
        {
          type:
            mongoose.Schema.Types.ObjectId,
          ref: "TaskManagement",
        },
      ],

      remarks: {
        type: String,
      },

      status: {
        type: String,
        enum: [
          "Submitted",
          "Under Review",
          "Approved",
          "Rejected",
        ],
        default: "Submitted",
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
    }
  );

module.exports = mongoose.model(
  "DailyReport",
  dailyReportSchema
);