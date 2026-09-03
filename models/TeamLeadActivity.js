const mongoose =
  require("mongoose");

const teamLeadActivitySchema =
  new mongoose.Schema(
    {
      teamLeadId: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "User",
        required: true,
      }, 

      employeeId: {
        type:
          mongoose.Schema.Types
            .ObjectId,
        ref: "User",
      },

      activityType: {
        type: String,
        enum: [
          "attendance_review",
          "daily_report_approval",
          "task_assignment",
          "task_review",
          "performance_monitoring",
          "project_follow_up",
          "leave_approval",
        ],
        required: true,
      },

      referenceId: {
        type:
          mongoose.Schema.Types
            .ObjectId,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "approved",
          "rejected",
          "completed",
        ],
        default: "pending",
      },

      remarks: {
        type: String,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "TeamLeadActivity",
    teamLeadActivitySchema
  );