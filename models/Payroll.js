// const mongoose = require("mongoose");
 
// const payrollSchema = 
//   new mongoose.Schema(
//     { 
//       userId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "User",
//         required: true,
//       },
  
//       salaryStructureId: {
//         type:
//           mongoose.Schema.Types.ObjectId,
//         ref: "SalaryStructure", 
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


//       deduction: {
//         type: Number,
//         default: 0,
//       },

//       tdsAmount: {
//         type: Number,
//         default: 0,
//       },

//       grossSalary: {
//         type: Number,
//         required: true,
//       },

//       netSalary: {
//         type: Number,
//         required: true,
//       },

//       status: {
//         type: String,
//         enum: [
//           "pending",
//           "processed",
//           "paid",
//         ],
//         default: "pending",
//       },

//       paymentDate: {
//         type: Date,
//       },
//     },
//     { timestamps: true }
//   );

// payrollSchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });

// module.exports = mongoose.model(
//   "Payroll",
//   payrollSchema
// );

const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    salaryStructureId: {
      type: mongoose.Schema.Types.ObjectId,
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

    // Salary Structure Snapshot
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

    fixedDeduction: {
      type: Number,
      default: 0,
    },

    // Payroll Specific
    extraBonus: {
      type: Number,
      default: 0,
    },

    extraDeduction: {
      type: Number,
      default: 0,
    },

    grossSalary: {
      type: Number,
      required: true,
    },

    tdsPercentage: {
      type: Number,
      default: 0,
    },

    tdsAmount: {
      type: Number,
      default: 0,
    },

    totalDeduction: {
      type: Number,
      default: 0,
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
      default: "processed",
    },

    paymentDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

payrollSchema.index(
  {
    userId: 1,
    month: 1,
    year: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "Payroll",
  payrollSchema
);