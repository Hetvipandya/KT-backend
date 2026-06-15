const mongoose = require("mongoose");

const interviewRoundSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
      required: true,
    },

    roundType: { 
      type: String,
      required: true,
    },

    interviewerName: String,

    feedback: String,

    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 1,
    },

    status: {
      type: String,
      enum: ["pending", "passed", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InterviewRound", interviewRoundSchema);