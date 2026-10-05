const mongoose = require("mongoose");

const salaryStructureSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      index: true,
      default: null,
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
      default: null,
    },

    financialYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialYear",
      default: null,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },

    effectiveFrom: {
      type: Date,
      default: Date.now,
    },

    // Earnings
    basicSalary: {
      type: Number,
      required: true,
      default: 0,
    },

    hra: {
      type: Number,
      default: 0,
    },

    conveyanceAllowance: {
      type: Number,
      default: 0,
    },

    medicalAllowance: {
      type: Number,
      default: 0,
    },

    specialAllowance: {
      type: Number,
      default: 0,
    },

    allowance: {
      type: Number,
      default: 0,
    },

    otherAllowances: {
      type: Number,
      default: 0,
    },

    fixedBonus: {
      type: Number,
      default: 0,
    },

    grossSalary: {
      type: Number,
      default: 0,
    },

    // Deductions
    pfDeduction: {
      type: Number,
      default: 0,
    },

    esicDeduction: {
      type: Number,
      default: 0,
    },

    professionalTax: {
      type: Number,
      default: 0,
    },

    tds: {
      type: Number,
      default: 0,
    },

    tdsPercentage: {
      type: Number,
      default: 0,
    },

    fixedDeduction: {
      type: Number,
      default: 0,
    },

    otherDeductions: {
      type: Number,
      default: 0,
    },

    totalDeduction: {
      type: Number,
      default: 0,
    },

    netSalary: {
      type: Number,
      default: 0,
    },

    employerContributions: {
      pf: { type: Number, default: 0 },
      esic: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

salaryStructureSchema.pre("save", async function () {
  // Sync employeeId and userId if one is missing
  if (!this.employeeId && this.userId) {
    this.employeeId = this.userId;
  }
  if (!this.userId && this.employeeId) {
    this.userId = this.employeeId;
  }

  // Support fallback for legacy 'allowance' field into specialAllowance
  if (this.allowance && !this.specialAllowance) {
    this.specialAllowance = this.allowance;
  }

  this.grossSalary =
    Number(this.basicSalary || 0) +
    Number(this.hra || 0) +
    Number(this.conveyanceAllowance || 0) +
    Number(this.medicalAllowance || 0) +
    Number(this.specialAllowance || 0) +
    Number(this.otherAllowances || 0) +
    Number(this.fixedBonus || 0);

  const calculatedTds =
    this.tds > 0
      ? Number(this.tds)
      : (this.grossSalary * Number(this.tdsPercentage || 0)) / 100;

  this.totalDeduction =
    Number(this.pfDeduction || 0) +
    Number(this.esicDeduction || 0) +
    Number(this.professionalTax || 0) +
    calculatedTds +
    Number(this.fixedDeduction || 0) +
    Number(this.otherDeductions || 0);

  this.netSalary = Math.max(0, this.grossSalary - this.totalDeduction);
});

salaryStructureSchema.index(
  { userId: 1, isActive: 1 },
  { unique: false }
);

module.exports = mongoose.model("SalaryStructure", salaryStructureSchema);