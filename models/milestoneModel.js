const mongoose =
  require("mongoose");

const milestoneSchema = 
  new mongoose.Schema(
    {
      projectId: {
        type:
          mongoose.Schema
            .Types.ObjectId,
        ref: "Project",
        required: true,
      },
  assignedTasks: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
  ],
  
      title: {
        type: String,
        required: true,
        trim: true, 
      },

      description: {
        type: String,
        default: "",
      },

      dueDate: {
        type: Date,
        required: true,
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
          "in-progress",
          "under-review",
          "completed",
        ],
        default: "pending",
      },

      reviewComment: {
        type: String,
        default: "",
      },

      completedAt: {
        type: Date,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Milestone",
    milestoneSchema
  );