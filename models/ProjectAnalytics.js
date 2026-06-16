const mongoose = require("mongoose");

const projectAnalyticsSchema =
  new mongoose.Schema(
    {
      projectId: {
        type:
          mongoose.Schema.Types.ObjectId, 
        ref: "Project",
        required: true,
      },

      completionPercentage: {
        type: Number,
        default: 0,
      },

      taskCompletionRate: {
        type: Number,
        default: 0,
      },

      teamProductivity: {
        type: String,
        enum: [
          "Low",
          "Medium",
          "High",
        ],
        default: "Medium",
      },

      riskLevel: {
        type: String,
        enum: [
          "Low",
          "Medium",
          "High",
        ],
        default: "Low",
      },

      budgetUtilization: {
        type: Number,
        default: 0,
      },

      timelineStatus: {
        type: String,
        enum: [
          "On Track",
          "Delayed",
          "Completed",
        ],
        default: "On Track",
      },

      riskIndicators: {
        taskDelay: {
          type: Boolean,
          default: false,
        },

        missedDeadlines: {
          type: Boolean,
          default: false,
        },

        lowProductivity: {
          type: Boolean,
          default: false,
        },

        budgetOverrun: {
          type: Boolean,
          default: false,
        },

        resourceShortage: {
          type: Boolean,
          default: false,
        },
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "ProjectAnalytics",
    projectAnalyticsSchema
  );