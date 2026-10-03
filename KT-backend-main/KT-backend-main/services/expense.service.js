const Expense = require('../models/Expense');
const FinancialYear = require('../models/FinancialYear');
const Branch = require('../models/Branch');
const ChartOfAccount = require('../models/ChartOfAccount');
const BankAccount = require('../models/BankAccount');
const journalService = require('./journalEntry.service');

const fail = (message, statusCode = 400, errorCode) =>
  Object.assign(new Error(message), { statusCode, errorCode });

const validateRefs = async (data) => {
  const branch = await Branch.findOne({ _id: data.branchId, companyId: data.companyId });
  const fy = await FinancialYear.findOne({ _id: data.financialYearId, companyId: data.companyId, branchId: data.branchId });
  if (!branch || !fy) {
    throw fail('Branch or financial year does not belong to the company', 400, 'INVALID_BRANCH_FINANCIAL_YEAR');
  }
};

const create = async (data, userId) => {
  await validateRefs(data);
  if (Math.abs(data.totalAmount - (data.amount + data.taxAmount)) > 0.01) {
    throw fail('totalAmount is inconsistent', 400, 'INVALID_TOTALS');
  }
  const expenseAccount = await ChartOfAccount.findOne({
    _id: data.expenseAccountId,
    companyId: data.companyId,
    isActive: true,
    isGroup: false
  });
  if (!expenseAccount) {
    throw fail('Expense account not found', 404, 'ACCOUNT_NOT_FOUND');
  }

  // Resolve taxRateId if passed as string rate (e.g. "18" or "18%") or ObjectId
  if (data.taxRateId) {
    const mongoose = require('mongoose');
    const Tax = require('../models/Tax');
    if (mongoose.Types.ObjectId.isValid(data.taxRateId)) {
      const existingTax = await Tax.findById(data.taxRateId);
      if (existingTax) data.taxRateId = existingTax._id;
    } else {
      const numericRate = parseFloat(String(data.taxRateId).replace('%', ''));
      if (!isNaN(numericRate)) {
        const matchingTax = await Tax.findOne({ companyId: data.companyId, ratePercent: numericRate })
          || await Tax.findOne({ ratePercent: numericRate });
        if (matchingTax) {
          data.taxRateId = matchingTax._id;
        } else {
          const newTax = await Tax.create({
            companyId: data.companyId,
            name: `GST ${numericRate}%`,
            ratePercent: numericRate,
            taxCategory: 'Taxable',
            isActive: true
          });
          data.taxRateId = newTax._id;
        }
      }
    }
  }

  // Auto-link BankAccount if paymentMode is CASH and bankAccountId was not provided
  if (!data.bankAccountId && data.paymentMode === 'CASH') {
    const cashBank = await BankAccount.findOne({
      companyId: data.companyId,
      accountType: 'Cash',
      isActive: true,
      ...(data.branchId ? { $or: [{ branchId: data.branchId }, { branchId: null }] } : {})
    }) || await BankAccount.findOne({ companyId: data.companyId, accountType: 'Cash', isActive: true });

    if (cashBank) {
      data.bankAccountId = cashBank._id;
    }
  }

  // ── INSUFFICIENT BALANCE CHECK ───────────────────────────────────────────
  let creditCoaAccountId = null;
  let targetAccountName = 'selected account';

  if (data.bankAccountId) {
    const bank = await BankAccount.findOne({ _id: data.bankAccountId, companyId: data.companyId });
    if (bank) {
      creditCoaAccountId = bank.coaAccountId;
      targetAccountName = bank.accountName || bank.bankName || 'Bank Account';
    }
  }

  if (!creditCoaAccountId) {
    const cashAccount = await ChartOfAccount.findOne({
      companyId: data.companyId,
      code: { $in: ['1210', '1200'] },
      isActive: true,
      isGroup: false
    }) || await ChartOfAccount.findOne({
      companyId: data.companyId,
      type: 'Asset',
      name: /cash/i,
      isActive: true,
      isGroup: false
    });
    if (cashAccount) {
      creditCoaAccountId = cashAccount._id;
      targetAccountName = cashAccount.name || 'Cash Account';
    }
  }

  if (creditCoaAccountId) {
    const bankAccountService = require('./bankAccount.service');
    const currentBalance = await bankAccountService.getAccountBalance(creditCoaAccountId);

    if (Number(data.totalAmount || 0) > Number(currentBalance || 0)) {
      const formattedBalance = `₹${Number(currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const formattedExpense = `₹${Number(data.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      throw fail(
        `Insufficient balance in ${targetAccountName}. Available balance is ${formattedBalance}, but expense total is ${formattedExpense}.`,
        400,
        'INSUFFICIENT_BALANCE'
      );
    }
  }

  const expense = await Expense.create({
    ...data,
    expenseDate: new Date(data.expenseDate),
    createdBy: userId,
    updatedBy: userId
  });

  // Post corresponding Journal Entry for accounting flow
  try {
    let creditCoaAccountId = null;
    if (data.bankAccountId) {
      const bank = await BankAccount.findOne({ _id: data.bankAccountId, companyId: data.companyId });
      if (bank) creditCoaAccountId = bank.coaAccountId;
    }

    if (!creditCoaAccountId) {
      // Fallback to Cash account
      const cashAccount = await ChartOfAccount.findOne({
        companyId: data.companyId,
        code: { $in: ['1210', '1200'] },
        isActive: true,
        isGroup: false
      }) || await ChartOfAccount.findOne({
        companyId: data.companyId,
        type: 'Asset',
        name: /cash/i,
        isActive: true,
        isGroup: false
      });
      if (cashAccount) creditCoaAccountId = cashAccount._id;
    }

    if (creditCoaAccountId) {
      const lines = [
        {
          accountId: data.expenseAccountId,
          debit: data.amount,
          credit: 0,
          remarks: data.description || 'Expense'
        },
        ...(data.taxAmount > 0 ? [{
          accountId: data.expenseAccountId,
          debit: data.taxAmount,
          credit: 0,
          remarks: 'Tax amount'
        }] : []),
        {
          accountId: creditCoaAccountId,
          debit: 0,
          credit: data.totalAmount,
          remarks: `Expense payment (${data.paymentMode})`
        }
      ];

      const entry = await journalService.createJournalEntry({
        companyId: data.companyId,
        branchId: data.branchId || null,
        financialYearId: data.financialYearId,
        entryDate: new Date(data.expenseDate),
        reference: data.reference || `EXP-${expense._id.toString().slice(-6)}`,
        narration: `Expense: ${data.category} - ${data.description}`,
        lines
      }, userId);

      expense.journalEntryId = entry._id;
      await expense.save();
    }
  } catch (err) {
    // If journal posting fails, expense remains created with journalEntryId = null
    console.error('Failed to post automatic journal entry for expense:', err.message);
  }

  const populated = await Expense.findById(expense._id)
    .populate('expenseAccountId', 'name code')
    .populate('bankAccountId', 'accountName bankName accountType')
    .populate('branchId', 'branchName')
    .populate('vendorId', 'name')
    .lean();

  return shapeExpense(populated);
};

const shapeExpense = (exp) => {
  if (!exp) return null;
  const obj = typeof exp.toObject === 'function' ? exp.toObject() : exp;

  const expenseAccountName = obj.expenseAccountId?.name || null;
  const expenseAccountCode = obj.expenseAccountId?.code || null;
  const bankAccountName = obj.bankAccountId?.accountName || obj.bankAccountId?.bankName || null;
  const branchName = obj.branchId?.branchName || null;
  const vendorName = obj.vendorId?.name || null;

  return {
    ...obj,
    expenseAccountId: obj.expenseAccountId?._id?.toString() || (typeof obj.expenseAccountId === 'string' ? obj.expenseAccountId : obj.expenseAccountId?.toString()) || null,
    expenseAccountName,
    expenseAccountCode,
    expenseAccount: expenseAccountName ? { id: obj.expenseAccountId?._id?.toString() || obj.expenseAccountId, name: expenseAccountName, code: expenseAccountCode } : null,
    bankAccountId: obj.bankAccountId?._id?.toString() || (typeof obj.bankAccountId === 'string' ? obj.bankAccountId : obj.bankAccountId?.toString()) || null,
    bankAccountName,
    bankAccount: bankAccountName ? { id: obj.bankAccountId?._id?.toString() || obj.bankAccountId, accountName: bankAccountName } : null,
    branchId: obj.branchId?._id?.toString() || (typeof obj.branchId === 'string' ? obj.branchId : obj.branchId?.toString()) || null,
    branchName,
    vendorId: obj.vendorId?._id?.toString() || (typeof obj.vendorId === 'string' ? obj.vendorId : obj.vendorId?.toString()) || null,
    vendorName,
    supplierName: vendorName
  };
};

const list = async (companyId, query) => {
  const filter = { companyId };
  if (query.branchId) filter.branchId = query.branchId;
  if (query.financialYearId) filter.financialYearId = query.financialYearId;

  const items = await Expense.find(filter)
    .populate('expenseAccountId', 'name code')
    .populate('bankAccountId', 'accountName bankName accountType')
    .populate('branchId', 'branchName')
    .populate('vendorId', 'name')
    .sort({ expenseDate: -1 })
    .lean();

  return items.map(shapeExpense);
};

const get = async (id) => {
  const item = await Expense.findById(id)
    .populate('expenseAccountId', 'name code')
    .populate('bankAccountId', 'accountName bankName accountType')
    .populate('branchId', 'branchName')
    .populate('vendorId', 'name')
    .lean();
  return shapeExpense(item);
};

module.exports = {
  create,
  list,
  get,
  shapeExpense
};

