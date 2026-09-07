const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },

    resume: {
      type: String, // file URL
      default: null,
    },

    status: {
      type: String,
      enum: [
        "registered",
        "interview",
        "selected",
        "rejected",
        "offer_sent",
        "joined",
        "intern", 
      ],
      default: "registered",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema); 