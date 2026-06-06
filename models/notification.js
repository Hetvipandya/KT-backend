const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null = system-wide notification
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["EMAIL", "SMS", "SYSTEM", "ANNOUNCEMENT"],
      default: "SYSTEM",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    metaData: {
      type: Object, // extra info like orderId, projectId etc
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);