const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    leadName: {
      type: String,
      required: true,
    },

    companyName: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    source: {
      type: String,
      enum: [
        "website",
        "facebook",
        "instagram",
        "linkedin",
        "reference",
        "other",
      ],
      default: "other",
    },

    inquiry: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "lead",
        "inquiry",
        "followup",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      default: "lead",
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Lead",
  leadSchema
);