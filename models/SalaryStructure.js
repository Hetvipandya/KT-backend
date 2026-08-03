// const mongoose = require("mongoose");

// const salaryStructureSchema =
//   new mongoose.Schema(
//     {
//       userId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "User",
//         required: true, 
//       },

//       basicSalary: { 
//         type: Number, 
//         required: true,
//       },

//       hra: {
//         type: Number,
//         default: 0,
//       },

//       allowance: {
//         type: Number,
//         default: 0,
//       },

//       bonus: {
//         type: Number,
//         default: 0,
//       },

//       deduction: {
//         type: Number,
//         default: 0,
//       },

//       tdsPercentage: {
//         type: Number,
//         default: 0,
//       },

//       netSalary: {
//         type: Number,
//       },

//       isActive: {
//         type: Boolean,
//         default: true,
//       },
//     },
//     { timestamps: true }
//   );

// salaryStructureSchema.index(
//   { userId: 1 },
//   {
//     unique: true,
//     partialFilterExpression: { isActive: true },
//   }
// );

// module.exports = mongoose.model(
//   "SalaryStructure",
//   salaryStructureSchema
// );

const mongoose = require("mongoose");

const salaryStructureSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    basicSalary: {
      type: Number,
      required: true,
      default: 0,
    },

    hra: {
      type: Number,
      default: 0,
    },

    allowance: {
      type: Number,
      default: 0,
    },

    // Fixed Monthly Bonus
    fixedBonus: {
      type: Number,
      default: 0,
    },

    // Fixed Monthly Deduction
    fixedDeduction: {
      type: Number,
      default: 0,
    },

    tdsPercentage: {
      type: Number,
      default: 0,
    },

    grossSalary: {
      type: Number,
      default: 0,
    },

    netSalary: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

salaryStructureSchema.pre("save", function (next) {
  this.grossSalary =
    Number(this.basicSalary) +
    Number(this.hra) +
    Number(this.allowance) +
    Number(this.fixedBonus);

  const tdsAmount =
    (this.grossSalary * Number(this.tdsPercentage)) / 100;

  this.netSalary =
    this.grossSalary -
    Number(this.fixedDeduction) -
    tdsAmount;

  next();
});

salaryStructureSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
    },
  }
);

module.exports = mongoose.model(
  "SalaryStructure",
  salaryStructureSchema
);