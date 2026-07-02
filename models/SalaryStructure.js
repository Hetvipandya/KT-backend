const mongoose = require("mongoose");

const salaryStructureSchema =
  new mongoose.Schema(
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      basicSalary: { 
        type: Number,
        required: true,
      },

      hra: {
        type: Number,
        default: 0,
      },

      allowance: {
        type: Number,
        default: 0,
      },

      bonus: {
        type: Number,
        default: 0,
      },

      deduction: {
        type: Number,
        default: 0,
      },

      tdsPercentage: {
        type: Number,
        default: 0,
      },

      netSalary: {
        type: Number,
      },

      isActive: {
        type: Boolean,
        default: true,
      },
    },
    { timestamps: true }
  );

module.exports = mongoose.model(
  "SalaryStructure",
  salaryStructureSchema
);