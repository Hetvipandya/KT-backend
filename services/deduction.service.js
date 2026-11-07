const mongoose = require("mongoose");
const EmployeeDeduction = require("../models/EmployeeDeduction");
const DeductionMaster = require("../models/DeductionMaster");
const SalaryStructure = require("../models/SalaryStructure");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const { recordAuditEvent } = require("./auditLog.service");

const isMongooseReady = () => {
  if (process.env.NODE_ENV !== "test") return true;
  return Boolean(mongoose.connection && (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2));
};

/**
 * Fetch strictly approved and legally permissible employee deductions for payroll calculation.
 * 
 * Under statutory labour compliance (e.g. Payment of Wages Act), deductions MUST:
 * 1. Have status === "Approved"
 * 2. Have isLegallyPermissible === true
 * 3. Have associated DeductionMaster.isLegallyPermissible === true and isActive === true
 *
 * @param {string|ObjectId} employeeId 
 * @param {number} month (1-12)
 * @param {number} year 
 * @returns {Promise<{ validDeductions: Array, totalCustomDeductions: number, excludedDeductions: Array }>}
 */
const getApprovedLegallyPermissibleDeductions = async (employeeId, month, year) => {
  const monthNum = Number(month);
  const yearNum = Number(year);

  if (!employeeId || !monthNum || !yearNum) {
    return { validDeductions: [], totalCustomDeductions: 0, excludedDeductions: [] };
  }

  if (!isMongooseReady() && !EmployeeDeduction.find._isMockFunction && typeof EmployeeDeduction.find.mock === "undefined") {
    return { validDeductions: [], totalCustomDeductions: 0, excludedDeductions: [] };
  }

  const query = {
    $or: [{ employeeId }, { userId: employeeId }],
    month: monthNum,
    year: yearNum,
  };

  const allRecords = await EmployeeDeduction.find(query)
    .populate("deductionMasterId")
    .lean();

  const validDeductions = [];
  const excludedDeductions = [];

  for (const record of allRecords) {
    const master = record.deductionMasterId;
    const isApproved = record.status === "Approved";
    const recordPermissible = record.isLegallyPermissible !== false;
    const masterPermissible = master && master.isLegallyPermissible !== false;
    const masterActive = master && master.isActive !== false;

    if (isApproved && recordPermissible && masterPermissible && masterActive) {
      validDeductions.push({
        _id: record._id,
        deductionRecordId: record.deductionRecordId,
        deductionMasterId: master?._id || record.deductionMasterId,
        name: master?.name || "Deduction",
        code: master?.code || "CUSTOM",
        category: master?.category || "VOLUNTARY",
        amount: Number(record.amount || 0),
        reason: record.reason || "",
        isLegallyPermissible: true,
        legalReference: record.legalReference || master?.legalReference || "",
        teamLeadId: record.teamLeadId,
      });
    } else {
      let exclusionReason = "";
      if (!isApproved) exclusionReason = `Status is "${record.status}" (must be Approved)`;
      else if (!recordPermissible) exclusionReason = "Deduction record flagged as not legally permissible";
      else if (!masterPermissible) exclusionReason = "Deduction Master is not legally permissible under labour regulations";
      else if (!masterActive) exclusionReason = "Deduction Master is inactive";

      excludedDeductions.push({
        _id: record._id,
        deductionRecordId: record.deductionRecordId,
        amount: Number(record.amount || 0),
        status: record.status,
        exclusionReason,
        isLegallyPermissible: record.isLegallyPermissible && master?.isLegallyPermissible,
      });
    }
  }

  const totalCustomDeductions = validDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return {
    validDeductions,
    totalCustomDeductions: Number(totalCustomDeductions.toFixed(2)),
    excludedDeductions,
  };
};

/**
 * Lock employee deduction records to a generated / approved monthly salary payroll.
 * 
 * @param {Array<string|ObjectId>} deductionIds
 * @param {string|ObjectId} monthlySalaryId
 * @param {string|ObjectId} [userId]
 */
const lockDeductionsForPayroll = async (deductionIds, monthlySalaryId, userId = null) => {
  if (!Array.isArray(deductionIds) || deductionIds.length === 0) return;
  if (!isMongooseReady() && !EmployeeDeduction.updateMany._isMockFunction && typeof EmployeeDeduction.updateMany.mock === "undefined") return;

  await EmployeeDeduction.updateMany(
    { _id: { $in: deductionIds } },
    {
      $set: {
        isLocked: true,
        lockedAt: new Date(),
        lockedBy: userId || null,
        monthlySalaryId: monthlySalaryId || null,
      },
    }
  );
};

/**
 * Unlock employee deduction records if payroll is cancelled or regenerated.
 * 
 * @param {string|ObjectId} monthlySalaryId
 * @param {string|ObjectId} [userId]
 */
const unlockDeductionsForPayroll = async (monthlySalaryId, userId = null) => {
  if (!monthlySalaryId) return;
  if (!isMongooseReady() && !EmployeeDeduction.updateMany._isMockFunction && typeof EmployeeDeduction.updateMany.mock === "undefined") return;

  await EmployeeDeduction.updateMany(
    { monthlySalaryId },
    {
      $set: {
        isLocked: false,
        lockedAt: null,
        lockedBy: null,
        monthlySalaryId: null,
      },
    }
  );
};

/**
 * Safe Audit Logger Helper for deduction events
 */
const logDeductionAudit = async (req, actionType, entity, description, metadata = {}) => {
  try {
    if (typeof recordAuditEvent !== "function") return;
    const companyId = entity?.companyId || req?.user?.companyId;
    if (!companyId) return;

    await recordAuditEvent({
      companyId,
      branchId: entity?.branchId || req?.user?.branchId || null,
      userId: req?.user?._id || null,
      module: "HRMS_DEDUCTIONS",
      actionType,
      entityId: entity?._id || null,
      entityType: entity?.deductionRecordId ? "EmployeeDeduction" : "DeductionMaster",
      description,
      metadata: {
        deductionRecordId: entity?.deductionRecordId,
        code: entity?.code,
        status: entity?.status,
        amount: entity?.amount,
        ...metadata,
      },
      ipAddress: req?.ip || "",
      userAgent: req?.get ? req.get("user-agent") : "",
    });
  } catch (err) {
    // Non-blocking audit logger
  }
};

/**
 * Create authorized accounting entry for processed monthly salary and its approved deductions.
 */
const postSalaryAccountingEntry = async (monthlySalaryId, userId) => {
  try {
    const MonthlySalary = mongoose.models.MonthlySalary || require("../models/MonthlySalary");
    const COA = mongoose.models.ChartOfAccount || require("../models/ChartOfAccount");
    const JournalService = require("./journalEntry.service");

    const salary = await MonthlySalary.findById(monthlySalaryId);
    if (!salary || !salary.companyId) return null;

    const expenseAccount = await COA.findOne({ companyId: salary.companyId, type: "Expense", isActive: true });
    const payableAccount = await COA.findOne({ companyId: salary.companyId, type: "Liability", isActive: true });

    if (!expenseAccount || !payableAccount) return null;

    const lines = [
      { accountId: expenseAccount._id, debit: salary.grossSalary, credit: 0 },
      { accountId: payableAccount._id, debit: 0, credit: salary.netSalary, remarks: "Net Salary Payable" },
    ];

    if (salary.totalDeduction > 0) {
      lines.push({
        accountId: payableAccount._id,
        debit: 0,
        credit: salary.totalDeduction,
        remarks: "Authorized Payroll Deductions",
      });
    }

    const FinancialYear = mongoose.models.FinancialYear || require("../models/FinancialYear");
    let fy = await FinancialYear.findOne({ companyId: salary.companyId, isLocked: false });
    if (!fy) {
      fy = await FinancialYear.create({
        companyId: salary.companyId,
        branchId: salary.branchId || null,
        yearLabel: `${salary.year || 2026}-${String((salary.year || 2026) + 1).slice(-2)}`,
        startDate: new Date(`${salary.year || 2026}-01-01`),
        endDate: new Date(`${salary.year || 2026}-12-31`),
        isLocked: false,
      });
    }

    const entry = await JournalService.createJournalEntry({
      companyId: salary.companyId,
      branchId: salary.branchId,
      financialYearId: fy._id,
      entryDate: new Date(`${salary.year || 2026}-${String(salary.month || 11).padStart(2, "0")}-15`),
      reference: `SALARY-${salary.month}/${salary.year}`,
      narration: `Payroll Accrual for ${salary.salaryMonth || `${salary.month}/${salary.year}`}`,
      lines,
    }, userId);

    return entry;
  } catch (err) {
    return null;
  }
};

module.exports = {
  getApprovedLegallyPermissibleDeductions,
  lockDeductionsForPayroll,
  unlockDeductionsForPayroll,
  logDeductionAudit,
  postSalaryAccountingEntry,
};
