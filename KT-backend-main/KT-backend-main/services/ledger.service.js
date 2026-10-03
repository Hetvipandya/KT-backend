const mongoose = require('mongoose');
const ChartOfAccount = require('../models/ChartOfAccount');
const FinancialYear = require('../models/FinancialYear');
const JournalEntry = require('../models/JournalEntry');

const serviceError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
};

const formatFinancialYear = (financialYear) => financialYear ? {
  id: financialYear._id,
  label: financialYear.yearLabel
} : null;

const resolveContext = async (accountId, filters) => {
  const { companyId, financialYearId } = filters;
  if (!mongoose.isValidObjectId(accountId)) {
    throw serviceError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
  }
  const account = await ChartOfAccount.findOne({ _id: accountId, companyId }).lean();
  if (!account) throw serviceError('Account not found', 404, 'ACCOUNT_NOT_FOUND');

  let financialYear = null;
  if (financialYearId) {
    financialYear = await FinancialYear.findById(financialYearId).lean();
    if (!financialYear) throw serviceError('Financial year not found', 404, 'FINANCIAL_YEAR_NOT_FOUND');
    if (financialYear.companyId.toString() !== companyId.toString()) {
      throw serviceError('Financial year does not belong to the specified company', 400, 'INVALID_FINANCIAL_YEAR_COMPANY');
    }
  }
  return { account, financialYear };
};

const signedOpeningBalance = (account) =>
  account.openingBalanceType === 'Cr' ? -account.openingBalance : account.openingBalance;

const balanceType = (amount) => amount >= 0 ? 'DR' : 'CR';

/**
 * Builds account movements from Module 12 Journal Entry lines.
 * TODO: Merge invoice, payment, purchase, expense, salary, and other posted
 * transactions as their modules expose accounting postings. Keep chronological
 * ordering and the same running-balance calculation for every source.
 */
const loadJournalMovements = async (accountId, filters) => {
  const journalFilter = { companyId: filters.companyId };
  if (filters.financialYearId) journalFilter.financialYearId = filters.financialYearId;

  const journals = await JournalEntry.find(journalFilter)
    .select('entryDate reference narration lines createdAt reversedFrom isReversed')
    .sort({ entryDate: 1, createdAt: 1 })
    .lean();

  return journals.flatMap((journal) => journal.lines
    .filter((line) => line.accountId.toString() === accountId.toString())
    .map((line, index) => ({
      date: journal.entryDate,
      createdAt: journal.createdAt,
      lineIndex: index,
      entryId: journal._id,
      source: 'journal-entry',
      reference: journal.reference || null,
      narration: journal.narration || null,
      remarks: line.remarks || null,
      debit: line.debit,
      credit: line.credit,
      isReversal: Boolean(journal.reversedFrom),
      movement: line.debit - line.credit
    })));
};

/**
 * Loads unjournalized direct amount activities (Expense, Payment, SupplierPayment, Salary)
 * that have not yet generated or linked a JournalEntry.
 */
const loadDirectMovements = async (accountId, filters) => {
  const movements = [];
  const companyId = filters.companyId;

  const BankAccount = mongoose.model('BankAccount');
  const Expense = mongoose.model('Expense');
  const Payment = mongoose.model('Payment');
  const SupplierPayment = mongoose.model('SupplierPayment');
  const Salary = mongoose.model('Salary');

  // Check if this accountId corresponds to a BankAccount
  const bankAccount = await BankAccount.findOne({ coaAccountId: accountId }).lean();
  const bankAccountId = bankAccount ? bankAccount._id.toString() : null;

  // 1. Expenses without journalEntryId
  const expQuery = { companyId, journalEntryId: null };
  if (filters.financialYearId) expQuery.financialYearId = filters.financialYearId;

  const expenses = await Expense.find(expQuery).lean();
  for (const exp of expenses) {
    const isExpenseAccount = exp.expenseAccountId && exp.expenseAccountId.toString() === accountId.toString();
    const isMatchingBankAccount = bankAccountId && exp.bankAccountId && exp.bankAccountId.toString() === bankAccountId;
    const isCashFallback = !exp.bankAccountId && bankAccount && bankAccount.accountType === 'Cash';

    const isBank = isMatchingBankAccount || isCashFallback;

    if (isExpenseAccount) {
      movements.push({
        date: exp.expenseDate,
        createdAt: exp.createdAt,
        lineIndex: 0,
        entryId: exp._id,
        source: 'expense',
        reference: exp.reference || `EXP-${exp._id.toString().slice(-6)}`,
        narration: `Expense (${exp.category}): ${exp.description}`,
        remarks: exp.notes || null,
        debit: exp.totalAmount,
        credit: 0,
        isReversal: false,
        movement: exp.totalAmount
      });
    } else if (isBank) {
      movements.push({
        date: exp.expenseDate,
        createdAt: exp.createdAt,
        lineIndex: 1,
        entryId: exp._id,
        source: 'expense',
        reference: exp.reference || `EXP-${exp._id.toString().slice(-6)}`,
        narration: `Expense payment (${exp.category}): ${exp.description}`,
        remarks: exp.notes || null,
        debit: 0,
        credit: exp.totalAmount,
        isReversal: false,
        movement: -exp.totalAmount
      });
    }
  }

  // 2. Customer Payments without journalEntryId
  const payQuery = { companyId, journalEntryId: null, status: { $ne: 'REVERSED' } };
  if (filters.financialYearId) payQuery.financialYearId = filters.financialYearId;

  const payments = await Payment.find(payQuery).lean();
  for (const pay of payments) {
    const isBank = (bankAccountId && pay.bankAccountId && pay.bankAccountId.toString() === bankAccountId)
      || (bankAccount && bankAccount.accountType === 'Cash' && !pay.bankAccountId);
    if (isBank) {
      movements.push({
        date: pay.paymentDate,
        createdAt: pay.createdAt,
        lineIndex: 0,
        entryId: pay._id,
        source: 'customer-payment',
        reference: pay.paymentNumber || pay.reference,
        narration: `Received payment from ${pay.customerName}`,
        remarks: pay.notes || null,
        debit: pay.totalAmount,
        credit: 0,
        isReversal: false,
        movement: pay.totalAmount
      });
    }
  }

  // 3. Supplier Payments without journalEntryId
  const suppQuery = { companyId, journalEntryId: null, status: { $ne: 'REVERSED' } };
  if (filters.financialYearId) suppQuery.financialYearId = filters.financialYearId;

  const suppPayments = await SupplierPayment.find(suppQuery).lean();
  for (const sp of suppPayments) {
    const isBank = (bankAccountId && sp.bankAccountId && sp.bankAccountId.toString() === bankAccountId)
      || (bankAccount && bankAccount.accountType === 'Cash' && !sp.bankAccountId);
    if (isBank) {
      movements.push({
        date: sp.paymentDate,
        createdAt: sp.createdAt,
        lineIndex: 0,
        entryId: sp._id,
        source: 'supplier-payment',
        reference: sp.paymentNumber || sp.reference,
        narration: `Payment to supplier (${sp.mode})`,
        remarks: sp.notes || null,
        debit: 0,
        credit: sp.totalAmount,
        isReversal: false,
        movement: -sp.totalAmount
      });
    }
  }

  // 4. Salaries without journalEntryId
  const salQuery = { companyId, journalEntryId: null };
  if (filters.financialYearId) salQuery.financialYearId = filters.financialYearId;

  const salaries = await Salary.find(salQuery).lean();
  for (const sal of salaries) {
    const isSalaryExp = sal.salaryExpenseAccountId && sal.salaryExpenseAccountId.toString() === accountId.toString();
    const isBank = bankAccountId && sal.bankAccountId && sal.bankAccountId.toString() === bankAccountId;
    const isPayable = sal.payableAccountId && sal.payableAccountId.toString() === accountId.toString();

    if (isSalaryExp) {
      movements.push({
        date: sal.periodEnd || sal.createdAt,
        createdAt: sal.createdAt,
        lineIndex: 0,
        entryId: sal._id,
        source: 'salary',
        reference: sal.reference || 'SALARY',
        narration: `Salary expense for period ending ${sal.periodEnd ? new Date(sal.periodEnd).toISOString().split('T')[0] : ''}`,
        remarks: sal.notes || null,
        debit: sal.grossSalary || sal.netPayable,
        credit: 0,
        isReversal: false,
        movement: sal.grossSalary || sal.netPayable
      });
    } else if (isBank) {
      movements.push({
        date: sal.periodEnd || sal.createdAt,
        createdAt: sal.createdAt,
        lineIndex: 1,
        entryId: sal._id,
        source: 'salary',
        reference: sal.reference || 'SALARY',
        narration: `Salary payout (${sal.paymentMode})`,
        remarks: sal.notes || null,
        debit: 0,
        credit: sal.netPayable,
        isReversal: false,
        movement: -sal.netPayable
      });
    } else if (isPayable) {
      movements.push({
        date: sal.periodEnd || sal.createdAt,
        createdAt: sal.createdAt,
        lineIndex: 2,
        entryId: sal._id,
        source: 'salary',
        reference: sal.reference || 'SALARY',
        narration: `Salary payable`,
        remarks: sal.notes || null,
        debit: 0,
        credit: sal.netPayable,
        isReversal: false,
        movement: -sal.netPayable
      });
    }
  }

  return movements;
};

const loadAllMovements = async (accountId, filters) => {
  const journalMovements = await loadJournalMovements(accountId, filters);
  const directMovements = await loadDirectMovements(accountId, filters);
  const combined = [...journalMovements, ...directMovements];
  return combined.sort((a, b) => (new Date(a.date) - new Date(b.date)) || (new Date(a.createdAt) - new Date(b.createdAt)) || (a.lineIndex - b.lineIndex));
};

/**
 * Return chronological ledger history and running balances for one account.
 */
const getLedgerHistory = async (accountId, filters) => {
  const { account, financialYear } = await resolveContext(accountId, filters);
  const movements = await loadAllMovements(accountId, filters);
  const fromDate = filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : null;
  const toDate = filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : null;

  let runningBalance = signedOpeningBalance(account);
  for (const movement of movements) {
    if (fromDate && movement.date < fromDate) runningBalance += movement.movement;
  }
  const openingBalance = runningBalance;

  const visibleMovements = movements
    .filter((movement) => (!fromDate || movement.date >= fromDate) && (!toDate || movement.date <= toDate))
    .sort((a, b) => a.date - b.date || a.createdAt - b.createdAt || a.lineIndex - b.lineIndex);

  const entries = visibleMovements.map((movement) => {
    runningBalance += movement.movement;
    const isPositive = movement.movement > 0 || (movement.debit > 0 && movement.credit === 0);
    const rawAmount = Math.abs(movement.movement) || (movement.debit > 0 ? movement.debit : movement.credit);

    return {
      date: movement.date,
      entryId: movement.entryId,
      source: movement.source,
      reference: movement.reference,
      narration: movement.narration,
      remarks: movement.remarks,
      debit: movement.debit,
      credit: movement.credit,
      amount: isPositive ? rawAmount : -rawAmount,
      totalAmount: isPositive ? rawAmount : -rawAmount,
      displayAmount: isPositive ? rawAmount : -rawAmount,
      type: isPositive ? 'CR' : 'DR',
      transactionType: isPositive ? 'CREDIT' : 'DEBIT',
      isCredit: isPositive,
      isDebit: !isPositive,
      isReversal: movement.isReversal,
      runningBalance,
      balanceType: balanceType(runningBalance)
    };
  });

  return {
    account: { id: account._id, name: account.name, code: account.code },
    companyId: filters.companyId,
    financialYear: formatFinancialYear(financialYear),
    period: { from: filters.from || null, to: filters.to || null },
    openingBalance,
    entries,
    closingBalance: runningBalance,
    totals: {
      debit: visibleMovements.reduce((total, movement) => total + movement.debit, 0),
      credit: visibleMovements.reduce((total, movement) => total + movement.credit, 0)
    }
  };
};

const getLedgerBalance = async (accountId, filters) => {
  const history = await getLedgerHistory(accountId, filters);
  return {
    account: history.account,
    companyId: history.companyId,
    financialYear: history.financialYear,
    period: history.period,
    balance: Math.abs(history.closingBalance),
    balanceType: balanceType(history.closingBalance)
  };
};

module.exports = { getLedgerHistory, getLedgerBalance };
