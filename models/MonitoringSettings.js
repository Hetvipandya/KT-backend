const mongoose = require("mongoose");

const monitoringSettingsSchema = new mongoose.Schema(
  {
    intervalSeconds: {
      type: Number,
      default: 60, // Default interval 60 seconds
    },

    isMonitoringEnabled: {
      type: Boolean,
      default: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("MonitoringSettings", monitoringSettingsSchema);
