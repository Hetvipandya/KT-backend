const mongoose =
  require("mongoose");

const projectFollowUpSchema =
  new mongoose.Schema(
    {
      projectId: {
        type:
          mongoose.Schema
            .Types.ObjectId,
        ref: "Project",
        required: true,
      },

      followUpType: {
        type: String,
        enum: [
          "Daily",
          "Weekly",
          "Monthly",
          "Management",
        ],
        required: true,
      },

      // =================
      // DAILY FOLLOW-UP
      // =================
      dailyFollowUp: {
        taskStatus: {
          type: String,
        },

        issues: [
          {
            type: String,
          },
        ],

        blockers: [
          {
            type: String,
          },
        ],

        dependencies: [
          {
            type: String,
          },
        ],

        progressPercentage:
          {
            type: Number,
            min: 0,
            max: 100,
          },
      },

      // =================
      // WEEKLY FOLLOW-UP
      // =================
      weeklyFollowUp: {
        completedTasks: [
          {
            type: String,
          },
        ],

        pendingTasks: [
          {
            type: String,
          },
        ],

        resourceRequirement:
          {
            type: String,
          },

        performanceReview:
          {
            type: String,
          },

        clientFeedback: {
          type: String,
        },
      },

      // =================
      // MONTHLY REVIEW
      // =================
      monthlyReview: {
        projectHealth: {
          type: String,
          enum: [
            "Good",
            "Average",
            "Critical",
          ],
        },

        budgetUsage: {
          type: Number,
        },

        timelineStatus: {
          type: String,
        },

        riskAnalysis: {
          type: String,
        },

        teamPerformance: {
          type: String,
        },
      },

      // =================
      // MANAGEMENT REVIEW
      // =================
      managementReview: {
        projectHealth: {
          type: String,
          enum: [
            "Good",
            "Average",
            "Critical",
          ],
        },

        budgetUsage: {
          type: Number,
        },

        timelineStatus: {
          type: String,
        },

        riskAnalysis: {
          type: String,
        },

        teamPerformance: {
          type: String,
        },

        managementFeedback:
          {
            type: String,
          },

        actionItems: [
          {
            type: String,
          },
        ],
      },

      createdBy: {
        type:
          mongoose.Schema
            .Types.ObjectId,
        ref: "User",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "ProjectFollowUp",
    projectFollowUpSchema
  );