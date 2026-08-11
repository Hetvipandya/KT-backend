const mongoose = require("mongoose");

const employeePerformanceSchema = new mongoose.Schema(
  {
    employeeID: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Employee",
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

// Add index for better query performance
employeePerformanceSchema.index({ employeeID: 1 });
employeePerformanceSchema.index({ createdAt: -1 });

module.exports = mongoose.model("EmployeePerformance", employeePerformanceSchema);