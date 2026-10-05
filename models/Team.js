const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "", 
    },

    // Team Lead
    teamLeadId: {
      type: String,
      trim: true,
      default: "",
    },

    teamLeadUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    teamLeadEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    // Employees
    employees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
      },
    ],

    // Interns
    interns: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
    strictPopulate: false,
  }
);

module.exports = mongoose.model("Team", teamSchema); 