const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema( 
  {
    title: {
      type: String,
      required: true,
    },

    message: {
      type: String, 
      required: true,
    },

    targetRole: {
      type: String,
      default: "ALL", // ADMIN, EMPLOYEE, CLIENT, ALL
    },

    targetType: {
      type: String,
      enum: ["ALL", "ROLE", "PERSON", "DEPARTMENT"],
      default: "ALL",
    },

    targetUserIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],

    targetDepartmentIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    }],

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Announcement", announcementSchema);