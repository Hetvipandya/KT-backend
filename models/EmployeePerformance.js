const mongoose = require("mongoose");

const employeePerformanceSchema = new mongoose.Schema(
  {
    employeeID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      unique: true,
    },
    attendance: {
      type: Number,
      default: 0,
    },
    taskCompletion: {
      type: Number,
      default: 0,
    },
    projectContribution: {
      type: Number,
      default: 0,
    },
    lateComing: {
      type: Number,
      default: 0,
    },
    leave: {
      type: Number,
      default: 0, 
    },
    managerRating: {
      type: Number,
      default: 0,
    },
    kpiScore: {
      type: Number,
      default: 0,
    },
    overallGrade: {
      type: String,
      default: "F",
    },
    remarks: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("EmployeePerformance", employeePerformanceSchema);
