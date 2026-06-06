const mongoose = require("mongoose");

const payslipSchema =
  new mongoose.Schema(
    {
      payrollId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Payroll",
        required: true,
      },

      userId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
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

      grossSalary: {
        type: Number,
        required: true,
      },

      totalBonus: {
        type: Number,
        default: 0,
      },

      totalDeduction: {
        type: Number,
        default: 0,
      },

      tdsAmount: {
        type: Number,
        default: 0,
      },

      netSalary: {
        type: Number,
        required: true,
      },

      generatedDate: {
        type: Date,
        default: Date.now,
      },
    },
    { timestamps: true }
  );

module.exports = mongoose.model(
  "Payslip",
  payslipSchema
);