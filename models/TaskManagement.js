const mongoose = require("mongoose");

const taskManagementSchema =
  new mongoose.Schema(
    { 
      // Project
      projectId: { 
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
      },

      // Milestone
      milestoneId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "ProjectMilestone",
        default: null,
      },

      // Task Details
      taskTitle: {
        type: String,
        required: true,
        trim: true,
      },

      taskDescription: {
        type: String,
        default: "",
      },

      // Assigned Employee
      assignedEmployee: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      // Assigned Intern
      assignedIntern: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      // Assigned By
      assignedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      // Due Date
      dueDate: {
        type: Date,
        required: true,
      },

      // Estimated Hours
      estimatedHours: {
        type: Number,
        default: 0,
      },

      // Priority
      priority: {
        type: String,
        enum: [
          "Low",
          "Medium",
          "High",
          "Critical",
        ],
        default: "Medium",
      },

      // Status
      status: {
        type: String,
        enum: [
          "Pending",
          "Assigned",
          "In Progress",
          "Testing",
          "Review",
          "Completed",
          "Rejected",
        ],
        default: "Pending",
      },

      // Progress
      progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },

      // Attachments
      attachments: [
        {
          fileName: String,
          fileUrl: String,
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],

      // Comments
      comments: [
        {
          comment: String,

          commentedBy: {
            type:
              mongoose.Schema.Types
                .ObjectId,
            ref: "User",
          },

          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],

      // Task History
      taskHistory: [
        {
          action: String,

          updatedBy: {
            type:
              mongoose.Schema.Types
                .ObjectId,
            ref: "User",
          },

          date: {
            type: Date,
            default: Date.now,
          },
        },
      ],

      // Reassignment
      reassignedTo: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      // Dependencies
      taskDependencies: [
        {
          type:
            mongoose.Schema.Types
              .ObjectId,
          ref: "TaskManagement",
        },
      ],

      // Sub Tasks
      subTasks: [
        {
          title: String,

          isCompleted: {
            type: Boolean,
            default: false,
          },
        },
      ],

      // Checklist
      checklist: [
        {
          item: String,

          completed: {
            type: Boolean,
            default: false,
          },
        },
      ],

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