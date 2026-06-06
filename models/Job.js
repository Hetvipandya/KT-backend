const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    department: String,
    description: String,
    location: String,
    experience: String,

    isPublished: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", jobSchema);