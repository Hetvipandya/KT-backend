const mongoose = require("mongoose");

const milestoneSchema =
  new mongoose.Schema(
    {
      projectId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
      },

      title: {
        type: String,
        required: true,
      },

      description: String,

      dueDate: Date,

      status: {
        type: String,
        enum: [
          "pending",
          "completed",
        ],
        default: "pending",
      },
    },
    { timestamps: true }
  );

module.exports =
  mongoose.model(
    "Milestone",
    milestoneSchema
  );