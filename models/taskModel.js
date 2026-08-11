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
      default: null,
    },

    taskTitle: {
      type: String,
      required: true,
      trim: true,
    },

    taskDescription: {
      type: String,
      default: "",
    },

    // For employee assignments (User ID)
    assignedEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    // For intern assignments (Intern ID)
    assignedIntern: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

     // Team Lead User
assignedTeamLeadUser: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},

// Team Lead Employee
assignedTeamLeadEmployee: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Employee",
  default: null,
},

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    estimatedHours: {
      type: Number,
      default: 0,
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

    taskDependencies: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Task",
      default: [],
    },

    subTasks: {
      type: [String],
      default: [],
    },

    checklist: {
      type: [String],
      default: [],
    },

    comments: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          text: String,
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    attachments: {
      type: [
        {
          fileName: String,
          fileUrl: String,
        },
      ],
      default: [],
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

module.exports = mongoose.model("Task", taskSchema);