const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    companyName: String,

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