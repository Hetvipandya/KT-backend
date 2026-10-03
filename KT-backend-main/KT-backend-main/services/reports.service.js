/**
 * Module 14 — Reports Service (read-only aggregation layer)
 *
 * This service is intentionally a placeholder that returns well-typed zero
 * structures matching the final API contract.  Each function documents the
 * exact integration points that must be wired once the accounting modules are
 * production-ready.
 *
 * Decision (2026-08-10): branchId is accepted and stored in the response for
 * future branch-wise views, but aggregation is currently company-wide only.
 * When branch-dimension support is added, every // TODO [BRANCH] comment below
 * must be addressed.
 */

const FinancialYear = require('../models/FinancialYear');
const Branch        = require('../models/Branch');
const mongoose      = require('mongoose');

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Build a normalised period object from optional `from` / `to` strings.
 * @param {{ from?: string, to?: string }} filters
 * @returns {{ from: string|null, to: string|null }}
 */
const buildPeriod = ({ from, to } = {}) => ({
  from: from || null,
  to:   to   || null
});

/**
 * Resolve and validate optional branchId.
 * Returns the branch document or null (if not provided).
 * Throws a structured error if the branch is not found or does not belong to
 * the specified company.
 *
 * @param {string} companyId
 * @param {string|undefined} branchId
 * @returns {Promise<object|null>}
 */
const resolveBranch = async (companyId, branchId) => {
  if (!branchId) return null;
  if (!mongoose.isValidObjectId(branchId)) {
    const err = new Error('Branch not found');
    err.statusCode = 404;
    err.errorCode  = 'BRANCH_NOT_FOUND';
    throw err;
  }
  const branch = await Branch.findOne({ _id: branchId, companyId });
  if (!branch) {
    const err = new Error('Branch not found or does not belong to the specified company');
    err.statusCode = 400;
    err.errorCode  = 'INVALID_BRANCH';
    throw err;
  }
  return branch;
};

/**
 * Resolve and validate optional financialYearId.
 * Returns { id, label } or null.
 *
 * @param {string} companyId
 * @param {string|undefined} financialYearId
 * @returns {Promise<{ id: string, label: string }|null>}
 */
const resolveFinancialYear = async (companyId, financialYearId) => {
  if (!financialYearId) return null;
  if (!mongoose.isValidObjectId(financialYearId)) {
    const err = new Error('Financial year not found');
    err.statusCode = 404;
    err.errorCode  = 'FINANCIAL_YEAR_NOT_FOUND';
    throw err;
  }
  const fy = await FinancialYear.findById(financialYearId);
  if (!fy) {
    const err = new Error('Financial year not found');
    err.statusCode = 404;
    err.errorCode  = 'FINANCIAL_YEAR_NOT_FOUND';
    throw err;
  }
  if (fy.companyId.toString() !== companyId.toString()) {
    const err = new Error('Financial year does not belong to the specified company');
    err.statusCode = 400;
    err.errorCode  = 'INVALID_FINANCIAL_YEAR_COMPANY';
    throw err;
  }
  return { id: fy._id.toString(), label: fy.yearLabel };
};

// ─── Trial Balance ────────────────────────────────────────────────────────────

/**
 * Generate a Trial Balance for the given company + optional period.
 *
 * @param {string}  companyId
 * @param {string|undefined}  branchId
 * @param {{ financialYearId?, from?, to? }}  filters
 *
 * TODO [Module 12 — Journal Entry]:
 *   - Aggregate all posted JournalEntry.lines for the company/FY/period.
 *   - Group by accountId (ChartOfAccount, Module 3).
 *   - Sum line.debit and line.credit per account.
 *   - Derive balance = Math.abs(debit - credit), balanceType = debit >= credit ? 'DR' : 'CR'.
 *   - Populate account code & name from ChartOfAccount.
 *   - Compute grand totals: totals.debit = Σ(debit), totals.credit = Σ(credit).
 *
 * TODO [Module 13 — Ledger]:
 *   - Optionally use pre-aggregated Ledger balances for performance on large datasets.
 *
 * TODO [BRANCH]:
 *   - When branch-wise is activated, add { branchId } to the JournalEntry query filter.
 *   - Ensure JournalEntry model has a branchId field (Module 12 update required).
 *
 * @returns {Promise<object>} Trial balance payload
 */
const getTrialBalance = async (companyId, branchId, filters = {}) => {
  const [financialYear, branch] = await Promise.all([
    resolveFinancialYear(companyId, filters.financialYearId),
    resolveBranch(companyId, branchId)
  ]);

  const coas = await mongoose.model('ChartOfAccount').find({ companyId, isGroup: false }).lean();

  const journalFilter = { companyId };
  if (branchId) journalFilter.branchId = branchId;
  if (filters.financialYearId) journalFilter.financialYearId = filters.financialYearId;
  if (filters.from || filters.to) {
    journalFilter.entryDate = {};
    if (filters.from) journalFilter.entryDate.$gte = new Date(`${filters.from}T00:00:00.000Z`);
    if (filters.to) journalFilter.entryDate.$lte = new Date(`${filters.to}T23:59:59.999Z`);
  }

  const journals = await mongoose.model('JournalEntry').find(journalFilter).lean();

  const movements = new Map();
  for (const journal of journals) {
    for (const line of journal.lines) {
      const accIdStr = line.accountId.toString();
      if (!movements.has(accIdStr)) {
        movements.set(accIdStr, { debit: 0, credit: 0 });
      }
      const val = movements.get(accIdStr);
      val.debit += line.debit || 0;
      val.credit += line.credit || 0;
    }
  }

  let totalDebit = 0;
  let totalCredit = 0;

  const accounts = coas.map(coa => {
    const accIdStr = coa._id.toString();
    const mov = movements.get(accIdStr) || { debit: 0, credit: 0 };

    let debit = mov.debit;
    let credit = mov.credit;

    if (coa.openingBalance) {
      if (coa.openingBalanceType === 'Cr') {
        credit += coa.openingBalance;
      } else {
        debit += coa.openingBalance;
      }
    }

    const net = debit - credit;
    const balance = Math.abs(net);
    const balanceType = net >= 0 ? 'DR' : 'CR';

    totalDebit += debit;
    totalCredit += credit;

    return {
      accountId: accIdStr,
      code: coa.code,
      name: coa.name,
      debit,
      credit,
      balance,
      balanceType
    };
  }).filter(acc => acc.debit > 0 || acc.credit > 0 || acc.balance > 0);

  return {
    companyId:     companyId.toString(),
    branchId:      branch ? branch._id.toString() : null,
    financialYear: financialYear
      ? { id: financialYear.id, label: financialYear.label }
      : { id: null, label: null },
    period: buildPeriod(filters),
    totals: { debit: totalDebit, credit: totalCredit },
    accounts
  };
};

// ─── Profit & Loss ────────────────────────────────────────────────────────────

/**
 * Generate a Profit & Loss statement.
 *
 * TODO [Module 8 — Sales Invoice]:
 *   - Cross-reference invoice grandTotal amounts with journal postings to verify completeness.
 *
 * TODO [Module 10 — Purchase]:
 *   - Cross-reference purchase grandTotal amounts with journal postings (COGS/expense).
 *
 * TODO [Module 11 — Expenses / Salary]:
 *   - Include direct expense and salary postings in operating expenses.
 *
 * TODO [Module 24 — Credit/Debit Notes]:
 *   - Reflect credit note adjustments (reduces revenue) and debit note adjustments (reduces cost).
 *
 * TODO [BRANCH]:
 *   - Filter journal entries by branchId when branch-wise support is activated.
 *
 * @returns {Promise<object>} P&L payload
 */
const getProfitLoss = async (companyId, branchId, filters = {}) => {
  const [financialYear, branch] = await Promise.all([
    resolveFinancialYear(companyId, filters.financialYearId),
    resolveBranch(companyId, branchId)
  ]);

  const coas = await mongoose.model('ChartOfAccount').find({
    companyId,
    type: { $in: ['Income', 'Expense'] },
    isGroup: false
  }).lean();

  const journalFilter = { companyId };
  if (branchId) journalFilter.branchId = branchId;
  if (filters.financialYearId) journalFilter.financialYearId = filters.financialYearId;
  if (filters.from || filters.to) {
    journalFilter.entryDate = {};
    if (filters.from) journalFilter.entryDate.$gte = new Date(`${filters.from}T00:00:00.000Z`);
    if (filters.to) journalFilter.entryDate.$lte = new Date(`${filters.to}T23:59:59.999Z`);
  }

  const journals = await mongoose.model('JournalEntry').find(journalFilter).lean();

  const movements = new Map();
  for (const journal of journals) {
    for (const line of journal.lines) {
      const accIdStr = line.accountId.toString();
      if (!movements.has(accIdStr)) {
        movements.set(accIdStr, { debit: 0, credit: 0 });
      }
      const val = movements.get(accIdStr);
      val.debit += line.debit || 0;
      val.credit += line.credit || 0;
    }
  }

  const revenueAccounts = [];
  const cogsAccounts = [];
  const opexAccounts = [];

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const coa of coas) {
    const accIdStr = coa._id.toString();
    const mov = movements.get(accIdStr) || { debit: 0, credit: 0 };
    let debit = mov.debit;
    let credit = mov.credit;

    if (coa.openingBalance) {
      if (coa.openingBalanceType === 'Cr') {
        credit += coa.openingBalance;
      } else {
        debit += coa.openingBalance;
      }
    }

    if (coa.type === 'Income') {
      const netCredit = credit - debit;
      if (netCredit !== 0) {
        revenueAccounts.push({ accountId: accIdStr, name: coa.name, amount: netCredit });
        totalIncome += netCredit;
      }
    } else if (coa.type === 'Expense') {
      const netDebit = debit - credit;
      if (netDebit !== 0) {
        totalExpenses += netDebit;
        if (coa.code.startsWith('51') || coa.name.toLowerCase().includes('purchase')) {
          cogsAccounts.push({ accountId: accIdStr, name: coa.name, amount: netDebit });
        } else {
          opexAccounts.push({ accountId: accIdStr, name: coa.name, amount: netDebit });
        }
      }
    }
  }

  const lines = [
    { group: 'REVENUE', accounts: revenueAccounts },
    { group: 'COGS', accounts: cogsAccounts },
    { group: 'OPERATING_EXPENSES', accounts: opexAccounts }
  ].filter(g => g.accounts.length > 0);

  const netProfit = totalIncome - totalExpenses;

  return {
    companyId:     companyId.toString(),
    branchId:      branch ? branch._id.toString() : null,
    financialYear: financialYear
      ? { id: financialYear.id, label: financialYear.label }
      : { id: null, label: null },
    period:        buildPeriod(filters),
    totalIncome,
    totalExpenses,
    netProfit,
    lines
  };
};

// ─── Balance Sheet ────────────────────────────────────────────────────────────

/**
 * Generate a Balance Sheet.
 *
 * TODO [Module 13 — Ledger]:
 *   - Read closing balances of all COA accounts (Module 3) as of `asOfDate`.
 *   - Classify by COA type: Asset, Liability, Equity.
 *   - Verify accounting equation: totals.assets === totals.liabilities + totals.equity.
 *
 * TODO [BRANCH]:
 *   - Add branchId filter to ledger/journal queries when branch-wise activated.
 *
 * @returns {Promise<object>} Balance sheet payload
 */
const getBalanceSheet = async (companyId, branchId, filters = {}) => {
  const [financialYear, branch] = await Promise.all([
    resolveFinancialYear(companyId, filters.financialYearId),
    resolveBranch(companyId, branchId)
  ]);

  const asOfDate = filters.to || null;

  const coas = await mongoose.model('ChartOfAccount').find({
    companyId,
    type: { $in: ['Asset', 'Liability', 'Equity', 'Income', 'Expense'] },
    isGroup: false
  }).lean();

  const journalFilter = { companyId };
  if (branchId) journalFilter.branchId = branchId;
  if (filters.financialYearId) journalFilter.financialYearId = filters.financialYearId;
  if (asOfDate) {
    journalFilter.entryDate = { $lte: new Date(`${asOfDate}T23:59:59.999Z`) };
  }

  const journals = await mongoose.model('JournalEntry').find(journalFilter).lean();

  const movements = new Map();
  for (const journal of journals) {
    for (const line of journal.lines) {
      const accIdStr = line.accountId.toString();
      if (!movements.has(accIdStr)) {
        movements.set(accIdStr, { debit: 0, credit: 0 });
      }
      const val = movements.get(accIdStr);
      val.debit += line.debit || 0;
      val.credit += line.credit || 0;
    }
  }

  const assets = [];
  const liabilities = [];
  const equity = [];

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const coa of coas) {
    const accIdStr = coa._id.toString();
    const mov = movements.get(accIdStr) || { debit: 0, credit: 0 };
    let debit = mov.debit;
    let credit = mov.credit;

    if (coa.openingBalance) {
      if (coa.openingBalanceType === 'Cr') {
        credit += coa.openingBalance;
      } else {
        debit += coa.openingBalance;
      }
    }

    if (coa.type === 'Asset') {
      const bal = debit - credit;
      if (bal !== 0) {
        assets.push({ accountId: accIdStr, code: coa.code, name: coa.name, balance: bal });
        totalAssets += bal;
      }
    } else if (coa.type === 'Liability') {
      const bal = credit - debit;
      if (bal !== 0) {
        liabilities.push({ accountId: accIdStr, code: coa.code, name: coa.name, balance: bal });
        totalLiabilities += bal;
      }
    } else if (coa.type === 'Equity') {
      const bal = credit - debit;
      if (bal !== 0) {
        equity.push({ accountId: accIdStr, code: coa.code, name: coa.name, balance: bal });
        totalEquity += bal;
      }
    } else if (coa.type === 'Income') {
      totalIncome += (credit - debit);
    } else if (coa.type === 'Expense') {
      totalExpenses += (debit - credit);
    }
  }

  const netProfit = totalIncome - totalExpenses;
  if (netProfit !== 0) {
    equity.push({
      accountId: new mongoose.Types.ObjectId().toString(),
      code: 'RE-CURR',
      name: 'Current Period Net Profit',
      balance: netProfit
    });
    totalEquity += netProfit;
  }

  return {
    companyId:     companyId.toString(),
    branchId:      branch ? branch._id.toString() : null,
    financialYear: financialYear
      ? { id: financialYear.id, label: financialYear.label }
      : { id: null, label: null },
    asOfDate,
    totals: { assets: totalAssets, liabilities: totalLiabilities, equity: totalEquity },
    assets,
    liabilities,
    equity
  };
};

// ─── GST Report ───────────────────────────────────────────────────────────────

/**
 * Generate a GST Payable report (Output Tax − Input Tax).
 *
 * Defensively loads gst.service so this report remains usable when Module 25
 * has not been fully integrated yet.
 *
 * TODO [Module 24 — Credit/Debit Notes]:
 *   - Adjust output/input tax for credit and debit note reversals.
 *
 * TODO [BRANCH]:
 *   - Filter invoice/purchase queries by branchId when branch-wise activated.
 *
 * @returns {Promise<object>} GST report payload
 */
const getGstReport = async (companyId, branchId, filters = {}) => {
  const branch = await resolveBranch(companyId, branchId);

  let gstService;
  try {
    gstService = require('./gst.service');
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
  }

  let gstSummary = null;
  if (typeof gstService?.getGstReturnsSummary === 'function') {
    gstSummary = await gstService.getGstReturnsSummary(companyId, filters);
  }

  const details = gstSummary && Array.isArray(gstSummary.breakdownByRate) ? gstSummary.breakdownByRate.map((item) => ({
    taxRateId: null,
    taxName: `GST ${item.ratePercent}%`,
    ratePercent: item.ratePercent,
    gstType: 'GST',
    outputTax: item.outputTaxAmount || 0,
    inputTax: item.inputTaxAmount || 0,
    net: (item.outputTaxAmount || 0) - (item.inputTaxAmount || 0)
  })) : [];

  return {
    companyId: companyId.toString(),
    branchId:  branch ? branch._id.toString() : null,
    period:    buildPeriod(filters),
    summary: {
      outputTax:  gstSummary?.outputTax?.total  ?? 0,
      inputTax:   gstSummary?.inputTax?.total   ?? 0,
      netPayable: gstSummary?.netPayable ?? 0
    },
    details
  };
};

// ─── Export placeholder ───────────────────────────────────────────────────────

/**
 * Shared export wrapper — calls the appropriate report function and wraps it
 * in an export envelope.
 *
 * TODO: Integrate with an actual export engine (ExcelJS, PDFKit, or cloud
 * storage pre-signed URLs) once the project decides on an export infrastructure.
 * Until then, returns a JSON-serialised copy of the report payload.
 *
 * @param {'trial-balance'|'profit-loss'|'balance-sheet'|'gst'} reportType
 * @param {string}  companyId
 * @param {string|undefined}  branchId
 * @param {object}  filters
 * @returns {Promise<object>} Export envelope
 */
const exportReport = async (reportType, companyId, branchId, filters = {}) => {
  const reportFn = {
    'trial-balance': getTrialBalance,
    'profit-loss':   getProfitLoss,
    'balance-sheet': getBalanceSheet,
    'gst':           getGstReport
  }[reportType];

  if (!reportFn) {
    const err = new Error(`Unknown report type: ${reportType}`);
    err.statusCode = 400;
    throw err;
  }

  const company = await mongoose.model('Company').findById(companyId).lean();
  const payload = await reportFn(companyId, branchId, filters);

  const reportPdfService = require('./reportPdf.service');
  const cloudinaryService = require('./cloudinary.service');

  let pdfBuffer;
  if (reportType === 'trial-balance') {
    pdfBuffer = await reportPdfService.generateTrialBalancePdf(company, payload);
  } else if (reportType === 'profit-loss') {
    pdfBuffer = await reportPdfService.generateProfitLossPdf(company, payload);
  } else if (reportType === 'balance-sheet') {
    pdfBuffer = await reportPdfService.generateBalanceSheetPdf(company, payload);
  } else if (reportType === 'gst') {
    pdfBuffer = await reportPdfService.generateGstReportPdf(company, payload);
  }

  const uploadRes = await cloudinaryService.uploadReportPdf(reportType, companyId, pdfBuffer);

  return {
    reportType,
    companyId:       companyId.toString(),
    branchId:        payload.branchId || null,
    financialYearId: filters.financialYearId || null,
    exportFormat:    'pdf',
    downloadUrl:     uploadRes.secure_url,
    payload,
    note: 'Generated PDF successfully and uploaded to Cloudinary'
  };
};

module.exports = {
  getTrialBalance,
  getProfitLoss,
  getBalanceSheet,
  getGstReport,
  exportReport,
  // Helpers exported for use in controller
  resolveBranch,
  resolveFinancialYear
};
