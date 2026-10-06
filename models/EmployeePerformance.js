const mongoose = require("mongoose");

const employeePerformanceSchema = new mongoose.Schema(
  {
    employeeID: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Employee",
    },
 
    employeeType: {
      type: String,
      enum: ["employee", "intern", "teamlead"],
      default: "employee",
    },

    employeeName: {
      type: String,
      default: "",
    },

    employeeEmail: {
      type: String,
      default: "",
    },

    // Performance Percentage
    performancePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },

    remarks: {
      type: String,
      default: "",
    },

    feedback: {
      type: String,
      default: "",
    },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    evaluatorName: {
      type: String,
      default: "",
    },

    evaluatorRole: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Add index for better query performance
employeePerformanceSchema.index({ employeeID: 1 });
employeePerformanceSchema.index({ createdAt: -1 });

module.exports = mongoose.model(
  "EmployeePerformance",
  employeePerformanceSchema
);