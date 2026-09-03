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

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Announcement", announcementSchema);