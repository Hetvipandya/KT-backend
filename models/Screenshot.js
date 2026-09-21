const mongoose = require("mongoose");

const screenshotSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
    },

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

    date: {
      type: String,
      required: true, // YYYY-MM-DD
    },

    captureTime: {
      type: Date,
      default: Date.now,
    },

    checkInTime: {
      type: Date,
    },

    imageUrl: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Screenshot", screenshotSchema);
