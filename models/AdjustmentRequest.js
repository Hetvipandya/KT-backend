const mongoose = require("mongoose");

const adjustmentRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    // Old compatibility field
    requestedTime: {
      type: String,
      default: "",
    },

    // Multiple sessions
    sessions: [
      {
        checkin: {
          type: String,
          default: "",
        },

        checkout: {
          type: String,
          default: "",
        },
      },
    ],

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    adminDecision: {
      type: String,
      enum: ["present", "half-day", "absent", null],
      default: null,
    },

    adminNote: {
      type: String,
      default: "",
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "AdjustmentRequest",
  adjustmentRequestSchema
);