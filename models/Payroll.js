const mongoose = require("mongoose");
 
const payrollSchema = 
  new mongoose.Schema(
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
      },

      salaryStructureId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "SalaryStructure",
        required: true,
      },

      month: {
        type: Number,
        required: true,
      },

      year: {
        type: Number,
        required: true,
      },

      bonus: {
        type: Number,
        default: 0,
      },

      deduction: {
        type: Number,
        default: 0,
      },

      tdsAmount: {
        type: Number,
        default: 0,
      },

      grossSalary: {
        type: Number,
        required: true,
      },

      netSalary: {
        type: Number,
        required: true,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "processed",
          "paid",
        ],
        default: "pending",
      },

      paymentDate: {
        type: Date,
      },
    },
    { timestamps: true }
  );

module.exports = mongoose.model(
  "Payroll",
  payrollSchema
);