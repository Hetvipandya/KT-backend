const mongoose = require("mongoose");

const inactivityEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    employeeName: {
      type: String,
      required: true,
    },

    employeeID: {
      type: String,
      default: "",
    },

    sessionId: {
      type: String,
    },

    date: {
      type: String,
      required: true, // YYYY-MM-DD
    },

    inactivityStartTime: {
      type: Date,
      required: true,
    },

    durationMinutes: {
      type: Number,
      default: 5,
    },

    sessionStatus: {
      type: String,
      default: "active",
    },

    employeeResponse: {
      type: String,
      enum: ["pending", "working", "break", "no_response"],
      default: "pending",
    },

    respondedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("InactivityEvent", inactivityEventSchema);
