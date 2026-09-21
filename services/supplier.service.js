const FinancialYear = require('../models/FinancialYear');
const ChartOfAccount = require('../models/ChartOfAccount');
const ledgerService = require('./ledger.service');
const coaService = require('./coa.service');

const createLinkedCoaAccount = async (companyId, supplierName) => {
  const parentCode = '2310'; // "Sundry Creditors" group

  // Find parent account
  const parentCoa = await ChartOfAccount.findOne({ companyId, code: parentCode });
  if (!parentCoa) {
    const error = new Error('Default Chart of Accounts has not been seeded yet. Please seed the COA first.');
    error.statusCode = 409;
    throw error;
  }

  // Generate next available code
  const generatedCode = await coaService.generateNextCode(companyId, 'Liability');

  // Create the COA ledger account
  const coaAccount = await ChartOfAccount.create({
    companyId,
    name: supplierName,
    type: 'Liability',
    isGroup: false,
    parentId: parentCoa._id,
    code: generatedCode,
    openingBalance: 0,
    openingBalanceType: 'Cr',
    isSystemAccount: false,
    isActive: true
  });

  return coaAccount._id;
};

const createError = (message, statusCode = 400, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
};

const validateDate = (value, field) => {
  if (value && Number.isNaN(new Date(value).getTime())) {
    throw createError(`${field} must be a valid date`, 400, 'INVALID_DATE');
  }
};

/**
 * Returns the supplier payable ledger shape. Pulls ledger transactions from
 * Module 12/13 via ledgerService.getLedgerHistory using the supplier's payableAccountId.
 */
const getSupplierLedgerWithBalance = async (supplier, {
  companyId,
  financialYearId,
  from,
  to
} = {}) => {
  validateDate(from, 'from');
  validateDate(to, 'to');

  if (from && to && new Date(from) > new Date(to)) {
    throw createError('from date cannot be after to date', 400, 'INVALID_DATE_RANGE');
  }

  let financialYear = null;
  if (financialYearId) {
    financialYear = await FinancialYear.findOne({ _id: financialYearId, companyId }).lean();
    if (!financialYear) {
      throw createError(
        'Financial year does not belong to the specified company',
        400,
        'INVALID_FINANCIAL_YEAR_COMPANY'
      );
    }
  }

  if (!supplier.payableAccountId) {
    return {
      supplier: { id: supplier._id, name: supplier.name },
      companyId,
      financialYear: {
        id: financialYear?._id || null,
        label: financialYear?.yearLabel || null
      },
      period: { from: from || null, to: to || null },
      entries: [],
      totalDebit: 0,
      totalCredit: 0,
      payableBalance: 0,
      balanceType: 'CR'
    };
  }

  const history = await ledgerService.getLedgerHistory(supplier.payableAccountId.toString(), {
    companyId,
    financialYearId,
    from,
    to
  });

  return {
    supplier: { id: supplier._id, name: supplier.name },
    companyId,
    financialYear: history.financialYear,
    period: history.period,
    entries: history.entries,
    totalDebit: history.totals.debit,
    totalCredit: history.totals.credit,
    payableBalance: Math.abs(history.closingBalance),
    balanceType: history.closingBalance >= 0 ? 'DR' : 'CR'
  };
};

module.exports = { getSupplierLedgerWithBalance, createLinkedCoaAccount };
