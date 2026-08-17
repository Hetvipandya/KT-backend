const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
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
      trim: true,
    },

    clientEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    projectBudget: {
      type: Number,
      default: 0,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
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

    // ==========================
    // TEAM LEAD
    // ==========================

    teamLeadUser: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    teamLeadEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    // ==========================
    // EMPLOYEES 
    // ==========================

    employees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ==========================
    // INTERNS
    // ==========================

    interns: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ==========================
    // FILES
    // ==========================

    files: [
      {
        fileName: {
          type: String,
          default: "",
        },
        fileUrl: {
          type: String,
          default: "",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Project", projectSchema);