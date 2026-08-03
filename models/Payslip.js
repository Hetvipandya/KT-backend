//  const mongoose = require("mongoose");

// const payslipSchema =
//   new mongoose.Schema( 
//     {
//       payrollId: {
//         type:
//           mongoose.Schema.Types.ObjectId,
//         ref: "Payroll",
//         required: true,
//       },

//       userId: { 
//         type: 
//           mongoose.Schema.Types.ObjectId,
//         ref: "User",
//         required: true,
//       },

//       month: {
//         type: Number,
//         required: true,
//       },

//       year: {
//         type: Number,
//         required: true,
//       },

//       grossSalary: {
//         type: Number,
//         required: true,
//       },
 
//       totalBonus: {
//         type: Number,
//         default: 0,
//       },

//       totalDeduction: {
//         type: Number,
//         default: 0, 
//       },

//       tdsAmount: {
//         type: Number,
//         default: 0,
//       },

//       netSalary: {
//         type: Number,
//         required: true,
//       },

//       generatedDate: {
//         type: Date,
//         default: Date.now,
//       },
//     },
//     { timestamps: true }
//   );

// module.exports = mongoose.model(
//   "Payslip",
//   payslipSchema
// );

const mongoose = require("mongoose");

const payslipSchema = new mongoose.Schema(
  {
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      required: true,
      unique: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
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

    basicSalary: {
      type: Number,
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

    fixedBonus: {
      type: Number,
      default: 0,
    },

    extraBonus: {
      type: Number,
      default: 0,
    },

    grossSalary: {
      type: Number,
      required: true,
    },

    fixedDeduction: {
      type: Number,
      default: 0,
    },

    extraDeduction: {
      type: Number,
      default: 0,
    },

    totalDeduction: {
      type: Number,
      default: 0,
    },

    tdsPercentage: {
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
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Payslip",
  payslipSchema
);