const mongoose = require("mongoose");

const payslipSchema = new mongoose.Schema(
  {
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MonthlySalary",
      required: true,
      unique: true,
      index: true,
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

    month: {
      type: Number,
      required: true,
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

    dearnessAllowance: {
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

    fixedDeduction: {
      type: Number,
      default: 0,
    },

    extraDeduction: {
      type: Number,
      default: 0,
    },

    lopDeduction: {
      type: Number,
      default: 0,
    },

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
      default: 0,
    },

    status: {
      type: String,
      default: "PENDING",
    },

    paymentStatus: {
      type: String,
      default: "UNPAID",
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    totalDays: {
      type: Number,
      default: 30,
    },

    workingDays: {
      type: Number,
      default: 30,
    },

    presentDays: {
      type: Number,
      default: 30,
    },

    daysPayable: {
      type: Number,
      default: 30,
    },

    generatedDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "payslips",
  }
);

payslipSchema.index({ userId: 1, month: 1, year: 1 }, { unique: false });

/**
 * Synchronize a single MonthlySalary document to the Payslip collection
 */
const syncPayslipFromMonthlySalary = async (salaryDoc) => {
  if (!salaryDoc || !salaryDoc._id) return null;
  const targetUserId = salaryDoc.userId || salaryDoc.employeeId;
  if (!targetUserId) return null;

  const raw = typeof salaryDoc.toObject === "function" ? salaryDoc.toObject() : salaryDoc;

  const payslipPayload = {
    payrollId: raw._id,
    userId: targetUserId,
    employeeId: raw.employeeId || targetUserId,
    companyId: raw.companyId || null,
    branchId: raw.branchId || null,
    financialYearId: raw.financialYearId || null,
    month: Number(raw.month || 1),
    year: Number(raw.year || new Date().getFullYear()),
    salaryMonth: raw.salaryMonth || "",
    basicSalary: Number(raw.basicSalary || 0),
    hra: Number(raw.hra || 0),
    allowance: Number(raw.allowance || raw.specialAllowance || 0),
    conveyanceAllowance: Number(raw.conveyanceAllowance || 0),
    medicalAllowance: Number(raw.medicalAllowance || 0),
    specialAllowance: Number(raw.specialAllowance || 0),
    dearnessAllowance: Number(raw.dearnessAllowance || 0),
    otherAllowances: Number(raw.otherAllowances || 0),
    fixedBonus: Number(raw.fixedBonus || 0),
    extraBonus: Number(raw.extraBonus || 0),
    grossSalary: Number(raw.grossSalary || 0),
    fixedDeduction: Number(raw.fixedDeduction || 0),
    extraDeduction: Number(raw.extraDeduction || 0),
    lopDeduction: Number(raw.lopDeduction || 0),
    pfDeduction: Number(raw.pfDeduction || 0),
    esicDeduction: Number(raw.esicDeduction || 0),
    professionalTax: Number(raw.professionalTax || 0),
    totalDeduction: Number(raw.totalDeduction || 0),
    tdsPercentage: Number(raw.tdsPercentage || 0),
    tdsAmount: Number(raw.tdsAmount || 0),
    netSalary: Number(raw.netSalary || 0),
    status: raw.status || "PENDING",
    paymentStatus: raw.paymentStatus || (raw.status === "PAID" ? "PAID" : "UNPAID"),
    paymentDate: raw.paymentDate || null,
    totalDays: Number(raw.totalDays || 30),
    workingDays: Number(raw.workingDays || 30),
    presentDays: Number(raw.presentDays || 30),
    daysPayable: Number(raw.daysPayable || 30),
    generatedDate: raw.createdAt || new Date(),
  };

  const PayslipModel = mongoose.models.Payslip || mongoose.model("Payslip", payslipSchema);
  return await PayslipModel.findOneAndUpdate(
    { payrollId: raw._id },
    { $set: payslipPayload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Synchronize all existing MonthlySalary documents into Payslip collection and ensure collection exists
 */
const syncAllMonthlySalariesToPayslips = async () => {
  try {
    const PayslipModel = mongoose.models.Payslip || mongoose.model("Payslip", payslipSchema);
    const MonthlySalary = mongoose.models.MonthlySalary || require("./MonthlySalary");

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const collections = await mongoose.connection.db.listCollections({ name: "payslips" }).toArray();
      if (collections.length === 0) {
        await mongoose.connection.db.createCollection("payslips");
      }
    }

    if (typeof MonthlySalary.find === "function") {
      const salaries = await MonthlySalary.find({});
      for (const salary of salaries) {
        await syncPayslipFromMonthlySalary(salary).catch(() => {});
      }
    }
  } catch (err) {
    // Non-blocking sync
  }
};

const Payslip = mongoose.models.Payslip || mongoose.model("Payslip", payslipSchema);

module.exports = Payslip;
module.exports.syncPayslipFromMonthlySalary = syncPayslipFromMonthlySalary;
module.exports.syncAllMonthlySalariesToPayslips = syncAllMonthlySalariesToPayslips;