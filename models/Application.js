const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {

    // Student Details
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    linkedInProfile: {
      type: String,
      default: "",
      trim: true,
    },

    portfolioUrl: {
      type: String,
      default: "",
      trim: true,
    },

    resumeFileName: {
      type: String,
      default: "",
      trim: true,
    },

    resumeFilePath: {
      type: String,
      default: "",
      trim: true,
    },

    resumeFileUrl: {
      type: String,
      default: "",
      trim: true,
    },

    role: {
      type: String,
      required: true,
      trim: true,
    },

    // Application Details
    companyName: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "applied",
        "interview",
        "selected",
        "rejected",
        "offer_sent",
        "joined",
        "intern",
      ],
      default: "applied",
    },

    interviewDate: Date,
    offerLetterUrl: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", applicationSchema);