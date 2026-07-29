const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    milestoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Milestone",
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

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    startDate: {
      type: Date,
    },

    dueDate: {
      type: Date,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "in_progress",
        "testing",
        "review",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },

    remarks: {
      type: String,
      default: "",
    },

    completedAt: {
      type: Date,
      default: null,
    },

    attachments: [
      {
        fileName: String,
        fileUrl: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Task", taskSchema);