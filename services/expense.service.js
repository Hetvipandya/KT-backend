const Expense = require('../models/Expense');
const FinancialYear = require('../models/FinancialYear');
const Branch = require('../models/Branch');
const ChartOfAccount = require('../models/ChartOfAccount');
const BankAccount = require('../models/BankAccount');
const journalService = require('./journalEntry.service');
const { ensureExpenseLedger } = require('./autoCoaMapping.service');

const fail = (message, statusCode = 400, errorCode) =>
  Object.assign(new Error(message), { statusCode, errorCode });

const validateRefs = async (data) => {
  const branch = await Branch.findOne({ _id: data.branchId, companyId: data.companyId });
  const fy = await FinancialYear.findOne({ _id: data.financialYearId, companyId: data.companyId, branchId: data.branchId });
  if (!branch || !fy) {
    throw fail('Branch or financial year does not belong to the company', 400, 'INVALID_BRANCH_FINANCIAL_YEAR');
  }
};

const create = async (data, userId, { balanceAdjustment = 0 } = {}) => {
  await validateRefs(data);
  if (Math.abs(data.totalAmount - (data.amount + data.taxAmount)) > 0.01) {
    throw fail('totalAmount is inconsistent', 400, 'INVALID_TOTALS');
  }
  const expenseAccount = data.expenseAccountId
    ? await ChartOfAccount.findOne({
      _id: data.expenseAccountId,
      companyId: data.companyId,
      type: 'Expense',
      isActive: true,
      isGroup: false,
      $or: [{ branchId: data.branchId }, { branchId: null }]
    })
    : await ensureExpenseLedger(data.companyId, data.category);
  if (!expenseAccount) {
    throw fail('Expense account not found or is not an active expense ledger for this branch', 404, 'ACCOUNT_NOT_FOUND');
  }
  data.expenseAccountId = expenseAccount._id;

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

    const availableBalance = Number(currentBalance || 0) + Number(balanceAdjustment || 0);
    if (Number(data.totalAmount || 0) > availableBalance) {
      const formattedBalance = `Rs.${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const formattedExpense = `Rs.${Number(data.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      throw fail(
        `Insufficient balance in ${targetAccountName}. Available balance is ${formattedBalance}, but expense total is ${formattedExpense}.`,
        400,
        'INSUFFICIENT_BALANCE'
      );
    }
  }

  if (!creditCoaAccountId) {
    throw fail('An active cash or bank COA ledger is required to post this expense.', 400, 'PAYMENT_ACCOUNT_REQUIRED');
  }

  const expense = await Expense.create({
    ...data,
    expenseDate: new Date(data.expenseDate),
    createdBy: userId,
    updatedBy: userId
  });

  // Post corresponding Journal Entry for accounting flow
  let journalEntry;
  try {
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

    journalEntry = await journalService.createJournalEntry({
      companyId: data.companyId,
      branchId: data.branchId || null,
      financialYearId: data.financialYearId,
      entryDate: new Date(data.expenseDate),
      reference: data.reference || `EXP-${expense._id.toString().slice(-6)}`,
      narration: `Expense: ${data.category} - ${data.description}`,
      lines
    }, userId);

    expense.journalEntryId = journalEntry._id;
    await expense.save();
  } catch (error) {
    if (journalEntry) {
      try {
        await journalService.reverseJournalEntry(journalEntry._id, userId);
      } catch (reversalError) {
        console.error('Failed to reverse journal entry after expense posting failed:', reversalError.message);
      }
    }
    await Expense.deleteOne({ _id: expense._id });
    throw error;
  }

  const populated = await Expense.findById(expense._id)
    .populate('expenseAccountId', 'name code')
    .populate('taxRateId', 'name ratePercent isActive')
    .populate('bankAccountId', 'accountName bankName accountType')
    .populate('branchId', 'branchName')
    .populate('vendorId', 'name')
    .lean();

  return shapeExpense(populated);
};

const restoreExpenseJournal = async (expense, userId) => {
  let creditCoaAccountId = null;
  if (expense.bankAccountId) {
    const bank = await BankAccount.findOne({
      _id: expense.bankAccountId,
      companyId: expense.companyId
    });
    creditCoaAccountId = bank?.coaAccountId || null;
  }
  if (!creditCoaAccountId) {
    const cashAccount = await ChartOfAccount.findOne({
      companyId: expense.companyId,
      code: { $in: ['1210', '1200'] },
      isActive: true,
      isGroup: false
    }) || await ChartOfAccount.findOne({
      companyId: expense.companyId,
      type: 'Asset',
      name: /cash/i,
      isActive: true,
      isGroup: false
    });
    creditCoaAccountId = cashAccount?._id || null;
  }
  if (!creditCoaAccountId) {
    throw fail('An active cash or bank COA ledger is required to restore this expense.', 500, 'PAYMENT_ACCOUNT_REQUIRED');
  }

  const amount = Number(expense.amount) || 0;
  const taxAmount = Number(expense.taxAmount) || 0;
  const totalAmount = Number(expense.totalAmount) || amount + taxAmount;
  const journal = await journalService.createJournalEntry({
    companyId: expense.companyId,
    branchId: expense.branchId || null,
    financialYearId: expense.financialYearId,
    entryDate: new Date(expense.expenseDate),
    reference: expense.reference || `EXP-${expense._id.toString().slice(-6)}`,
    narration: `Expense: ${expense.category} - ${expense.description}`,
    lines: [
      {
        accountId: expense.expenseAccountId,
        debit: amount,
        credit: 0,
        remarks: expense.description || 'Expense'
      },
      ...(taxAmount > 0 ? [{
        accountId: expense.expenseAccountId,
        debit: taxAmount,
        credit: 0,
        remarks: 'Tax amount'
      }] : []),
      {
        accountId: creditCoaAccountId,
        debit: 0,
        credit: totalAmount,
        remarks: `Expense payment (${expense.paymentMode})`
      }
    ]
  }, userId);
  return journal;
};

const update = async (id, data, userId) => {
  const existing = await Expense.findOne({
    _id: id,
    companyId: data.companyId,
    branchId: data.branchId,
    isVoided: { $ne: true }
  });
  if (!existing) throw fail('Expense not found', 404, 'EXPENSE_NOT_FOUND');
  if (Math.abs(data.totalAmount - (data.amount + data.taxAmount)) > 0.01) {
    throw fail('totalAmount is inconsistent', 400, 'INVALID_TOTALS');
  }

  const samePaymentAccount = String(existing.bankAccountId || '') === String(data.bankAccountId || '');
  const balanceAdjustment = samePaymentAccount ? Number(existing.totalAmount) || 0 : 0;
  const replacement = await create({ ...data }, userId, { balanceAdjustment });
  let oldReversal = null;
  try {
    if (existing.journalEntryId) {
      oldReversal = await journalService.reverseJournalEntry(existing.journalEntryId, userId);
    }
    existing.isVoided = true;
    existing.voidedAt = new Date();
    existing.voidedBy = userId;
    existing.reversalJournalEntryId = oldReversal?.reversal?._id || null;
    existing.updatedBy = userId;
    await existing.save();
    return replacement;
  } catch (error) {
    const recoveryErrors = [];
    if (oldReversal?.reversal?._id) {
      try {
        const restored = await restoreExpenseJournal(existing, userId);
        existing.isVoided = false;
        existing.voidedAt = null;
        existing.voidedBy = null;
        existing.reversalJournalEntryId = null;
        existing.journalEntryId = restored._id;
        existing.updatedBy = userId;
        await existing.save();
      } catch (recoveryError) {
        recoveryErrors.push(recoveryError.message);
      }
    }
    try {
      const replacementJournalId = getJournalId(replacement.journalEntryId);
      if (replacementJournalId) {
        await journalService.reverseJournalEntry(replacementJournalId, userId);
      }
      await Expense.deleteOne({ _id: replacement._id });
    } catch (recoveryError) {
      recoveryErrors.push(recoveryError.message);
    }
    if (recoveryErrors.length) {
      error.message = `${error.message}. Expense accounting recovery also failed: ${recoveryErrors.join('; ')}`;
      error.statusCode = 500;
    }
    throw error;
  }
};

const remove = async (id, companyId, branchId, userId) => {
  const filter = { _id: id, companyId, isVoided: { $ne: true } };
  if (branchId) filter.branchId = branchId;
  const expense = await Expense.findOne(filter);
  if (!expense) throw fail('Expense not found', 404, 'EXPENSE_NOT_FOUND');

  let reversal = null;
  try {
    if (expense.journalEntryId) {
      reversal = await journalService.reverseJournalEntry(expense.journalEntryId, userId);
    }
    expense.isVoided = true;
    expense.voidedAt = new Date();
    expense.voidedBy = userId;
    expense.reversalJournalEntryId = reversal?.reversal?._id || null;
    expense.updatedBy = userId;
    await expense.save();
    return { id: expense._id, reversalJournalEntryId: expense.reversalJournalEntryId };
  } catch (error) {
    if (reversal?.reversal?._id) {
      try {
        const restored = await restoreExpenseJournal(expense, userId);
        expense.isVoided = false;
        expense.voidedAt = null;
        expense.voidedBy = null;
        expense.reversalJournalEntryId = null;
        expense.journalEntryId = restored._id;
        expense.updatedBy = userId;
        await expense.save();
      } catch (recoveryError) {
        error.message = `${error.message}. Expense accounting recovery also failed: ${recoveryError.message}`;
        error.statusCode = 500;
      }
    }
    throw error;
  }
};

const getJournalId = (value) => (
  value && typeof value === 'object' ? String(value._id || value.id || '') : String(value || '')
);

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
    taxRateId: obj.taxRateId?._id?.toString() || (typeof obj.taxRateId === 'string' ? obj.taxRateId : obj.taxRateId?.toString()) || null,
    taxRate: obj.taxRateId?.name ? {
      id: obj.taxRateId?._id?.toString() || obj.taxRateId?.toString(),
      name: obj.taxRateId.name,
      ratePercent: Number(obj.taxRateId.ratePercent) || 0,
      isActive: obj.taxRateId.isActive !== false
    } : null,
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
  const filter = { companyId, isVoided: { $ne: true } };
  if (query.branchId) filter.branchId = query.branchId;
  if (query.financialYearId) filter.financialYearId = query.financialYearId;

  const items = await Expense.find(filter)
    .populate('expenseAccountId', 'name code')
    .populate('taxRateId', 'name ratePercent isActive')
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
    .populate('taxRateId', 'name ratePercent isActive')
    .populate('bankAccountId', 'accountName bankName accountType')
    .populate('branchId', 'branchName')
    .populate('vendorId', 'name')
    .lean();
  return item?.isVoided ? null : shapeExpense(item);
};

module.exports = {
  create,
  update,
  remove,
  list,
  get,
  shapeExpense
};

