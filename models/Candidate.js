const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Job",
      required: true,
    },

    name: String,
    email: String,
    phone: String,
    resume: String,

    status: {
      type: String,
      enum: [
        "applied",
        "screening",
        "interview",
        "selected",
        "rejected",
        "offer_sent",
        "joined",
      ],
      default: "applied",
    },

    rating: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Candidate", candidateSchema);