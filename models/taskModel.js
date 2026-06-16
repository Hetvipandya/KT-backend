const mongoose = require("mongoose");

const taskSchema =
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

      taskTitle: {
        type: String,
        required: true,
      },

      description: {
        type: String,
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
      },

      startDate: Date,

      dueDate: Date,

      priority: {
        type: String,
        enum: [
          "low",
          "medium",
          "high",
        ],
        default: "medium",
      },

      progress: {
        type: Number,
        default: 0,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "in_progress",
          "completed",
        ],
        default: "pending",
      },
    },
    { timestamps: true }
  );

module.exports =
  mongoose.model(
    "Task",
    taskSchema
  );