const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true, 
    }, 

    interviewerName: String,
    date: Date,

    mode: {
      type: String,
      enum: ["online", "offline"],
    },

    feedback: String,

    rating: Number, 

    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Interview", interviewSchema);