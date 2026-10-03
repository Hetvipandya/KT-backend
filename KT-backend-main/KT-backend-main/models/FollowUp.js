const mongoose = require("mongoose");

const followUpSchema =
  new mongoose.Schema(
    {
      leadId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Lead",
        required: true,
      },

      followUpDate: {
        type: Date,
        required: true,
      },

      followUpType: {
        type: String,
        enum: [
          "call",
          "meeting",
          "email",
          "whatsapp"
        ],
        required: true,
      },

      remarks: {
        type: String,
        required: true,
      },

      nextFollowUpDate: {
        type: Date,
        default: null,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "completed"
        ],
        default: "pending",
      },
    },
    { timestamps: true }
  );

module.exports = mongoose.model(
  "FollowUp",
  followUpSchema
);