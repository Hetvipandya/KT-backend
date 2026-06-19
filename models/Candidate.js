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
    "pending",
    "approved",
    "rejected",
  ],
  default: "pending",
},

    rating: {
      type: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Candidate", candidateSchema);