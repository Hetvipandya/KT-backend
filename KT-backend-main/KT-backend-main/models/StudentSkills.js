const mongoose = require("mongoose");

const skillSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    skills: [String], // ["React", "Node", "MongoDB"]
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentSkills", skillSchema);