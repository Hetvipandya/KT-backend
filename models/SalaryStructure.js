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

    // 1. EARNINGS COMPONENTS
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

    grossSalary: {
      type: Number,
      default: 0,
    },

    // 2. STATUTORY & DEDUCTION COMPONENTS
    basicForPf: {
      type: Number,
      default: 0,
    },

    pfDeduction: {
      type: Number,
      default: 0, // Employee PF: (Basic + DA) * 12%
    },

    esicDeduction: {
      type: Number,
      default: 0, // Employee ESI: Gross * 0.75%
    },

    professionalTax: {
      type: Number,
      default: 0, // PT: As per state rules (e.g. Gross > 12000 => 200)
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

    // 3. EMPLOYER CONTRIBUTIONS & GRATUITY
    employerContributions: {
      pf: { type: Number, default: 0 }, // Employer PF: (Basic + DA) * 12%
      esic: { type: Number, default: 0 }, // Employer ESI: Gross * 0.75%
      gratuity: { type: Number, default: 0 }, // ((Basic + DA) * 15 * Years) / 26
      other: { type: Number, default: 0 },
    },

    yearsOfService: {
      type: Number,
      default: 1,
    },

    autoCalculateStatutory: {
      type: Boolean,
      default: true,
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
  // Sync employeeId & userId
  if (!this.employeeId && this.userId) this.employeeId = this.userId;
  if (!this.userId && this.employeeId) this.userId = this.employeeId;

  if (this.allowance && !this.specialAllowance) {
    this.specialAllowance = this.allowance;
  }

  // Formula 1: GROSS SALARY = Basic + HRA + Conveyance + Special + DA + Other Allowances + Fixed Bonus
  this.grossSalary =
    Number(this.basicSalary || 0) +
    Number(this.hra || 0) +
    Number(this.conveyanceAllowance || 0) +
    Number(this.medicalAllowance || 0) +
    Number(this.specialAllowance || 0) +
    Number(this.dearnessAllowance || 0) +
    Number(this.otherAllowances || 0) +
    Number(this.fixedBonus || 0);

  // Formula 9: BASIC FOR PF = Basic Salary + Dearness Allowance (DA)
  this.basicForPf = Number(this.basicSalary || 0) + Number(this.dearnessAllowance || 0);

  // Formula 2: PF (Employee) = (Basic + DA) * 12%
  if (this.autoCalculateStatutory && (!this.pfDeduction || this.isModified("basicSalary") || this.isModified("dearnessAllowance"))) {
    this.pfDeduction = Math.round(this.basicForPf * 0.12);
  }

  // Formula 3: PF (Employer) = (Basic + DA) * 12%
  const employerPf = Math.round(this.basicForPf * 0.12);

  // Formula 4: ESI (Employee) = Gross Salary * 0.75%
  if (this.autoCalculateStatutory && (!this.esicDeduction || this.isModified("basicSalary") || this.isModified("grossSalary"))) {
    this.esicDeduction = Math.round(this.grossSalary * 0.0075);
  }

  // Formula 5: PROFESSIONAL TAX = As per State Rules (Default: Gross > 12000 => 200)
  if (this.autoCalculateStatutory && (!this.professionalTax || this.isModified("basicSalary") || this.isModified("grossSalary"))) {
    this.professionalTax = this.grossSalary > 12000 ? 200 : 0;
  }

  // Formula 10: GRATUITY = ((Basic + DA) * 15 * Years) / 26
  const years = Number(this.yearsOfService || 1);
  const gratuityVal = Math.round((this.basicForPf * 15 * years) / 26);

  // Employer ESI = Gross *0.75%
  const employerEsic = Math.round(this.grossSalary * 0.0075);

  this.employerContributions = {
    pf: employerPf,
    esic: employerEsic,
    gratuity: gratuityVal,
    other: (this.employerContributions && this.employerContributions.other) || 0,
  };

  const calculatedTds =
    this.tds > 0
      ? Number(this.tds)
      : (this.grossSalary * Number(this.tdsPercentage || 0)) / 100;

  // Formula 6: TOTAL DEDUCTIONS = PF (Employee) + ESI + Professional Tax + TDS + Other Deductions
  this.totalDeduction =
    Number(this.pfDeduction || 0) +
    Number(this.esicDeduction || 0) +
    Number(this.professionalTax || 0) +
    calculatedTds +
    Number(this.fixedDeduction || 0) +
    Number(this.otherDeductions || 0);

  // Formula 7: NET SALARY = Gross Salary - Total Deductions
  this.netSalary = Math.max(0, Number((this.grossSalary - this.totalDeduction).toFixed(2)));
});

/**
 * Sync changes from SalaryStructure to any un-paid MonthlySalary records for this employee
 */
const syncSalaryStructureToMonthlySalaries = async (structure, options = {}) => {
  if (!structure?._id) {
    throw new Error("Cannot sync MonthlySalary without a saved SalaryStructure.");
  }

  const MonthlySalary = mongoose.models.MonthlySalary || require("./MonthlySalary");
  const targetEmployeeIds = Array.from(new Map(
    [structure.userId, structure.employeeId]
      .filter(Boolean)
      .map((employeeId) => [employeeId.toString(), employeeId])
  ).values());
  if (targetEmployeeIds.length === 0) {
    throw new Error("Cannot sync MonthlySalary without a SalaryStructure employee.");
  }

  const employeeSalaryQuery = {
    $or: [
      { salaryStructureId: structure._id },
      ...targetEmployeeIds.flatMap((employeeId) => [
        { userId: employeeId },
        { employeeId },
      ]),
    ],
  };
  const unpaidSalaryQuery = {
    $and: [
      { status: { $nin: ["Paid", "paid", "PAID"] } },
      {
        $or: [
          { paidAt: null },
          { paidAt: { $exists: false } },
        ],
      },
    ],
  };
  const eligibleSalaryQuery = options.includePaidSalaryId
    ? {
        $or: [
          unpaidSalaryQuery,
          { _id: options.includePaidSalaryId },
        ],
      }
    : unpaidSalaryQuery;
  const query = {
    $and: [employeeSalaryQuery, eligibleSalaryQuery],
  };

  const matchingSalaries = await MonthlySalary.find(query);
  for (const salary of matchingSalaries) {
    salary.basicSalary = Number(structure.basicSalary || 0);
    salary.hra = Number(structure.hra || 0);
    salary.conveyanceAllowance = Number(structure.conveyanceAllowance || 0);
    salary.medicalAllowance = Number(structure.medicalAllowance || 0);
    salary.specialAllowance = Number(structure.specialAllowance || structure.allowance || 0);
    salary.allowance = Number(structure.specialAllowance || structure.allowance || 0);
    salary.dearnessAllowance = Number(structure.dearnessAllowance || 0);
    salary.otherAllowances = Number(structure.otherAllowances || 0);
    salary.fixedBonus = Number(structure.fixedBonus || 0);

    salary.pfDeduction = Number(structure.pfDeduction || 0);
    salary.esicDeduction = Number(structure.esicDeduction || 0);
    salary.professionalTax = Number(structure.professionalTax || 0);
    salary.tds = Number(structure.tds || 0);
    salary.tdsPercentage = Number(structure.tdsPercentage || 0);
    salary.fixedDeduction = Number(structure.fixedDeduction || 0);
    salary.otherDeductions = Number(structure.otherDeductions || 0);

    if (structure.employerContributions) {
      salary.employerContributions = structure.employerContributions;
    }

    salary.salaryStructureId = structure._id;
    salary.salaryStructureSnapshot = typeof structure.toObject === "function" ? structure.toObject() : structure;

    salary.grossSalary = Number((
      salary.basicSalary +
      salary.hra +
      salary.conveyanceAllowance +
      salary.medicalAllowance +
      salary.specialAllowance +
      salary.dearnessAllowance +
      salary.otherAllowances +
      salary.fixedBonus +
      Number(salary.extraBonus || 0)
    ).toFixed(2));

    salary.basicForPf = Number(salary.basicSalary || 0) + Number(salary.dearnessAllowance || 0);

    salary.perDaySalary = salary.totalDays > 0
      ? Number((salary.grossSalary / salary.totalDays).toFixed(2))
      : 0;
    salary.lopDeduction = Number((salary.perDaySalary * Number(salary.lopDays || 0)).toFixed(2));

    const calculatedTds = salary.tds > 0
      ? Number(salary.tds)
      : (salary.grossSalary * Number(salary.tdsPercentage || 0)) / 100;
    salary.tdsAmount = Number(calculatedTds.toFixed(2));

    salary.totalDeduction = Number((
      salary.pfDeduction +
      salary.esicDeduction +
      salary.professionalTax +
      calculatedTds +
      salary.fixedDeduction +
      Number(salary.extraDeduction || 0) +
      salary.otherDeductions +
      Number(salary.lopDeduction || 0)
    ).toFixed(2));

    salary.netSalary = Math.max(0, Number((salary.grossSalary - salary.totalDeduction).toFixed(2)));

    await salary.save();
  }
  return matchingSalaries.length;
};

salaryStructureSchema.post("save", async function (doc) {
  await syncSalaryStructureToMonthlySalaries(doc);
});

salaryStructureSchema.index({ userId: 1, isActive: 1 }, { unique: false });

const SalaryStructure = mongoose.models.SalaryStructure || mongoose.model("SalaryStructure", salaryStructureSchema);

module.exports = SalaryStructure;
module.exports.syncSalaryStructureToMonthlySalaries = syncSalaryStructureToMonthlySalaries;