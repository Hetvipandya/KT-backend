const mongoose = require("mongoose");

const taskManagementSchema =
  new mongoose.Schema(
    {
      projectId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
      },

      milestoneId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Milestone",
        default: null,
      },

      taskId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Task",
        required: true,
      },

      taskTitle: {
        type: String,
        required: true,
        trim: true,
      },

      description: {
        type: String,
        default: "",
      },

      assignedTo: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      assignedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      startDate: {
        type: Date,
        default: Date.now,
      },

      deadline: {
        type: Date,
        required: true,
      },

      priority: {
        type: String,
        enum: [
          "low",
          "medium",
          "high",
        ],
        default: "medium",
      },

      status: {
        type: String,
        enum: [
          "pending",
          "in_progress",
          "review",
          "completed",
        ],
        default: "pending",
      },

      progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },

      remarks: {
        type: String,
        default: "",
      },

      completedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "TaskManagement",
    taskManagementSchema
  );