const mongoose = require("mongoose");

const projectSchema =
  new mongoose.Schema(
    {
      projectName: {
        type: String,
        required: true,
        trim: true,
      },

      projectDescription: {
        type: String,
        default: "",
      },

      clientName: {
        type: String,
        required: true,
      },

      clientEmail: {
        type: String,
      },

      projectBudget: {
        type: Number,
        default: 0,
      },

      startDate: {
        type: Date,
      },

      endDate: {
        type: Date,
      },

      priority: {
        type: String,
        enum: [
          "low",
          "medium",
          "high",
          "urgent",
        ],
        default: "medium",
      },

      status: {
        type: String,
        enum: [
          "pending",
          "in_progress",
          "completed",
          "cancelled",
        ],
        default: "pending",
      },

      teamLead: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      employees: [
        {
          type:
            mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],

      interns: [
        {
          type:
            mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],

      files: [
        {
          fileName: String,
          fileUrl: String,
        },
      ],
    },
    { timestamps: true }
  );

module.exports =
  mongoose.model(
    "Project",
    projectSchema
  );