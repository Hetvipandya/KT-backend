const mongoose = require("mongoose");

const educationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    degree: String,
    college: String,
    year: Number,
    percentage: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentEducation", educationSchema);