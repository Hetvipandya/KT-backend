const mongoose = require("mongoose");

const monthlySalarySchema = new mongoose.Schema(
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
      index: true,
      default: null,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },

    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },

    year: {
      type: Number,
      required: true,
      index: true,
    },

    salaryMonth: {
      type: String,
      default: "",
    },

    salaryStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryStructure",
      default: null,
    },

    salaryStructureSnapshot: {
      type: Object,
      default: {},
    },

    calculationMode: {
      type: String,
      enum: ["CALENDAR_DAYS", "THIRTY_DAYS", "WORKING_DAYS"],
      default: "CALENDAR_DAYS",
    },

    totalDays: {
      type: Number,
      default: 30,
    },

    presentDays: {
      type: Number,
      default: 30,
    },

    leaveDays: {
      type: Number,
      default: 0,
    },

    lopDays: {
      type: Number,
      default: 0,
    },

    perDaySalary: {
      type: Number,
      default: 0,
    },

    lopDeduction: {
      type: Number,
      default: 0,
    },

    // Earnings Snapshot & Calculations
    basicSalary: {
      type: Number,
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

    extraBonus: {
      type: Number,
      default: 0,
    },

    grossSalary: {
      type: Number,
      required: true,
      default: 0,
    },

    // Deductions Snapshot & Calculations
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

    tdsAmount: {
      type: Number,
      default: 0,
    },

    fixedDeduction: {
      type: Number,
      default: 0,
    },

    extraDeduction: {
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
      required: true,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Draft", "Generated", "Approved", "Paid", "Cancelled", "pending", "processed", "paid"],
      default: "Generated",
      index: true,
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },

    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    paymentMode: {
      type: String,
      enum: ["BANK_TRANSFER", "CASH", "CHEQUE", "OTHER"],
      default: "BANK_TRANSFER",
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

monthlySalarySchema.pre("save", async function () {
  if (!this.userId && this.employeeId) {
    this.userId = this.employeeId;
  }
  if (!this.employeeId && this.userId) {
    this.employeeId = this.userId;
  }

  // Format month name if missing
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  if (!this.salaryMonth && this.month && this.year) {
    this.salaryMonth = `${monthNames[this.month - 1] || ''} ${this.year}`.trim();
  }
});

monthlySalarySchema.index(
  { employeeId: 1, month: 1, year: 1 },
  { unique: true }
);

module.exports = mongoose.model("MonthlySalary", monthlySalarySchema);
