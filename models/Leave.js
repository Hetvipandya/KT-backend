const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    leaveType: {
      type: String,
      enum: ["casual", "sick", "paid", "unpaid"],
      required: true,
    },

    startDate: {
      type: Date, 
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    totalDays: {
      type: Number,
      required: true,
    },

    reason: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    teamLeadStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    hrStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    adminStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    remark: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Leave", leaveSchema);