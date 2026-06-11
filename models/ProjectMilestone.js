const mongoose = require("mongoose");

const projectMilestoneSchema =
  new mongoose.Schema(
    {
      projectId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
      },

      milestoneTitle: {
        type: String,
        required: true,
      },

      description: {
        type: String,
      },

      dueDate: {
        type: Date,
      },

      status: {
        type: String,
        enum: [
          "Pending",
          "In Progress",
          "Completed",
        ],
        default: "Pending",
      },
    },
    { timestamps: true }
  );

module.exports =
  mongoose.model(
    "ProjectMilestone",
    projectMilestoneSchema
  );