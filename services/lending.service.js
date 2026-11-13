const mongoose = require('mongoose');
const Lending = require('../models/Lending');
const Branch = require('../models/Branch');
const Customer = require('../models/Customer');
const FinancialYear = require('../models/FinancialYear');
const BankAccount = require('../models/BankAccount');
const ChartOfAccount = require('../models/ChartOfAccount');
const coaService = require('./coa.service');
const bankAccountService = require('./bankAccount.service');
const journalService = require('./journalEntry.service');
const { ensureIncomeLedger } = require('./autoCoaMapping.service');

const EPSILON = 0.01;
const id = (value) => value?._id ? value._id.toString() : value?.toString() || null;
const fail = (message, statusCode = 400, errorCode) => Object.assign(new Error(message), { statusCode, errorCode });
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validatePeriod = async (companyId, branchId, financialYearId, dateValue) => {
  const branch = await Branch.findOne({ _id: branchId, companyId });
  if (!branch) throw fail('Branch does not belong to the specified company', 400, 'INVALID_BRANCH');
  const financialYear = await FinancialYear.findById(financialYearId);
  if (!financialYear || id(financialYear.companyId) !== id(companyId)) {
    throw fail('Financial year does not belong to the specified company', 400, 'INVALID_FINANCIAL_YEAR_COMPANY');
  }
  if (financialYear.branchId && id(financialYear.branchId) !== id(branchId)) {
    throw fail('Financial year does not belong to the specified branch', 400, 'INVALID_FINANCIAL_YEAR_BRANCH');
  }
  if (financialYear.isLocked) throw fail('Cannot post to a locked financial year', 409, 'FINANCIAL_YEAR_LOCKED');
  const date = new Date(dateValue);
  if (date < financialYear.startDate || date > financialYear.endDate) {
    throw fail('Transaction date must fall within the selected financial year', 400, 'DATE_OUTSIDE_FINANCIAL_YEAR');
  }
  return financialYear;
};

const getBankAccount = async (companyId, branchId, bankAccountId) => {
  const account = await BankAccount.findOne({
    _id: bankAccountId,
    companyId,
    isActive: true,
    branchId: { $in: [branchId, null] },
  });
  if (!account) throw fail('Active bank or cash account not found for this company and branch', 404, 'BANK_ACCOUNT_NOT_FOUND');
  return account;
};

const createReceivableLedger = async (lending) => {
  const mappingKey = `lending-receivable:${id(lending._id)}`;
  const findMapped = () => ChartOfAccount.findOne({ companyId: lending.companyId, autoMapKey: mappingKey, isGroup: false });
  const existing = await findMapped();
  if (existing) {
    if (existing.isActive === false) throw fail(`Lending account "${existing.name}" is inactive`, 409, 'LENDING_ACCOUNT_INACTIVE');
    return existing;
  }

  const parent = await ChartOfAccount.findOne({
    companyId: lending.companyId,
    branchId: null,
    code: '1200',
    type: 'Asset',
    isGroup: true,
    isActive: true,
  });
  if (!parent) {
    throw fail('Default Current Assets COA group is unavailable. Seed the Chart of Accounts first.', 409, 'LENDING_COA_GROUP_UNAVAILABLE');
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await coaService.generateNextCode(lending.companyId, 'Asset');
    try {
      return await ChartOfAccount.create({
        companyId: lending.companyId,
        branchId: null,
        name: `Loan Receivable - ${lending.customerName} (${id(lending._id).slice(-6).toUpperCase()})`,
        code,
        type: 'Asset',
        isGroup: false,
        parentId: parent._id,
        autoMapKey: mappingKey,
        isActive: true,
        openingBalance: 0,
        openingBalanceType: 'Dr',
        isSystemAccount: false,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const mapped = await findMapped();
      if (mapped) return mapped;
      if (attempt === 4) throw error;
    }
  }
  throw fail('Unable to allocate a lending receivable account', 500, 'LENDING_ACCOUNT_CREATION_FAILED');
};

const shape = (document, detail = false) => {
  const lending = typeof document.toObject === 'function' ? document.toObject() : document;
  return {
    id: id(lending._id || lending.id),
    companyId: id(lending.companyId),
    branchId: id(lending.branchId),
    financialYearId: id(lending.financialYearId),
    customerId: id(lending.customerId),
    customerName: lending.customerName,
    customerPhone: lending.customerPhone || '',
    loanReference: lending.loanReference || '',
    principalAmount: lending.principalAmount,
    principalOutstanding: lending.principalOutstanding,
    annualInterestRatePercent: lending.annualInterestRatePercent,
    startDate: lending.startDate,
    maturityDate: lending.maturityDate || null,
    disbursementBankAccountId: id(lending.disbursementBankAccountId),
    disbursementAccountName: lending.disbursementAccountName || '',
    receivableAccountId: id(lending.receivableAccountId),
    totalPrincipalRepaid: lending.totalPrincipalRepaid || 0,
    totalInterestReceived: lending.totalInterestReceived || 0,
    status: lending.status,
    notes: lending.notes || '',
    repaymentCount: (lending.repayments || []).length,
    ...(detail ? {
      repayments: (lending.repayments || []).map((repayment) => ({
        id: id(repayment._id),
        financialYearId: id(repayment.financialYearId),
        paymentDate: repayment.paymentDate,
        principalAmount: repayment.principalAmount,
        interestAmount: repayment.interestAmount,
        totalAmount: repayment.totalAmount,
        bankAccountId: id(repayment.bankAccountId),
        bankAccountName: repayment.bankAccountName || '',
        reference: repayment.reference || '',
        notes: repayment.notes || '',
        createdAt: repayment.createdAt,
      })),
    } : {}),
    createdAt: lending.createdAt,
    updatedAt: lending.updatedAt,
  };
};

const reverseJournalOrThrow = async (entry, userId, originalError) => {
  try {
    await journalService.reverseJournalEntry(entry._id, userId);
  } catch (reversalError) {
    throw fail(
      `${originalError.message || 'Lending transaction could not be completed.'} The journal entry ${entry._id} also could not be reversed: ${reversalError.message}`,
      500,
      'LENDING_JOURNAL_ROLLBACK_FAILED',
    );
  }
};

const createLending = async (data, userId) => {
  const startDate = new Date(data.startDate);
  await validatePeriod(data.companyId, data.branchId, data.financialYearId, startDate);
  if (data.maturityDate && new Date(data.maturityDate) <= startDate) {
    throw fail('Maturity date must be after the lending start date', 400, 'INVALID_MATURITY_DATE');
  }
  const customer = await Customer.findOne({
    _id: data.customerId,
    companyId: data.companyId,
    isActive: { $ne: false },
    branchId: { $in: [data.branchId, null] },
  });
  if (!customer) throw fail('Active customer not found for this company and branch', 404, 'CUSTOMER_NOT_FOUND');
  const bankAccount = await getBankAccount(data.companyId, data.branchId, data.disbursementBankAccountId);
  const availableBalance = Number(await bankAccountService.getAccountBalance(bankAccount.coaAccountId));
  const principalAmount = money(data.principalAmount);
  if (!Number.isFinite(availableBalance)) {
    throw fail('Could not verify the selected account balance. Try again before recording the loan.', 503, 'ACCOUNT_BALANCE_UNAVAILABLE');
  }
  if (availableBalance + EPSILON < principalAmount) {
    throw fail(`Insufficient funds in ${bankAccount.accountName}. Available: ${Math.max(availableBalance, 0).toFixed(2)}; required: ${principalAmount.toFixed(2)}.`, 409, 'INSUFFICIENT_FUNDS');
  }

  const lending = await Lending.create({
    ...data,
    customerName: customer.name || customer.customerName,
    customerPhone: customer.phone || '',
    startDate,
    maturityDate: data.maturityDate ? new Date(data.maturityDate) : null,
    principalAmount,
    principalOutstanding: principalAmount,
    status: 'ACTIVE',
    disbursementAccountName: bankAccount.accountName,
    createdBy: userId,
    updatedBy: userId,
  });

  let initialJournal = null;
  try {
    const receivableAccount = await createReceivableLedger(lending);
    initialJournal = await journalService.createJournalEntry({
      companyId: data.companyId,
      branchId: data.branchId,
      financialYearId: data.financialYearId,
      entryDate: startDate,
      reference: data.loanReference || `LEND-${id(lending._id).slice(-8).toUpperCase()}`,
      narration: `Loan given to ${lending.customerName}`,
      entrySource: 'AUTOMATIC',
      lines: [
        { accountId: receivableAccount._id, debit: principalAmount, credit: 0, remarks: 'Loan receivable recognized' },
        { accountId: bankAccount.coaAccountId, debit: 0, credit: principalAmount, remarks: 'Loan disbursed from bank/cash' },
      ],
    }, userId);
    lending.receivableAccountId = receivableAccount._id;
    lending.initialJournalEntryId = initialJournal._id;
    await lending.save();
    return shape(lending, true);
  } catch (error) {
    if (initialJournal) await reverseJournalOrThrow(initialJournal, userId, error);
    await Lending.deleteOne({ _id: lending._id });
    throw error;
  }
};

const listLendings = async (query) => {
  const summaryFilter = { companyId: query.companyId };
  if (query.branchId) summaryFilter.branchId = query.branchId;
  const filter = { ...summaryFilter };
  if (query.status) filter.status = query.status;
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ customerName: pattern }, { loanReference: pattern }];
  }
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const [records, total, aggregate] = await Promise.all([
    Lending.find(filter).sort({ startDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Lending.countDocuments(filter),
    Lending.aggregate([
      { $match: summaryFilter },
      { $group: {
        _id: null,
        principalAmount: { $sum: '$principalAmount' },
        principalRepaid: { $sum: { $subtract: ['$principalAmount', '$principalOutstanding'] } },
        principalOutstanding: { $sum: '$principalOutstanding' },
        interestReceived: { $sum: '$totalInterestReceived' },
        activeLoans: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
        paidOffLoans: { $sum: { $cond: [{ $eq: ['$status', 'PAID_OFF'] }, 1, 0] } },
      } },
    ]),
  ]);
  return {
    items: records.map((record) => shape(record)),
    pagination: { page, limit, total },
    summary: {
      principalAmount: aggregate[0]?.principalAmount || 0,
      principalRepaid: aggregate[0]?.principalRepaid || 0,
      principalOutstanding: aggregate[0]?.principalOutstanding || 0,
      interestReceived: aggregate[0]?.interestReceived || 0,
      activeLoans: aggregate[0]?.activeLoans || 0,
      paidOffLoans: aggregate[0]?.paidOffLoans || 0,
    },
  };
};

const getLending = async (lendingId, companyId, branchId) => {
  if (!mongoose.isValidObjectId(lendingId)) throw fail('Lending record not found', 404, 'LENDING_NOT_FOUND');
  const filter = { _id: lendingId, companyId };
  if (branchId) filter.branchId = branchId;
  const lending = await Lending.findOne(filter).lean();
  if (!lending) throw fail('Lending record not found', 404, 'LENDING_NOT_FOUND');
  return shape(lending, true);
};

const createRepayment = async (lendingId, data, userId, branchId) => {
  if (!mongoose.isValidObjectId(lendingId)) throw fail('Lending record not found', 404, 'LENDING_NOT_FOUND');
  const filter = { _id: lendingId, companyId: data.companyId };
  if (branchId) filter.branchId = branchId;
  const lending = await Lending.findOne(filter);
  if (!lending) throw fail('Lending record not found', 404, 'LENDING_NOT_FOUND');
  if (lending.status !== 'ACTIVE') throw fail('A paid-off lending account cannot receive further repayments', 409, 'LENDING_ALREADY_PAID_OFF');

  const paymentDate = new Date(data.paymentDate);
  await validatePeriod(data.companyId, lending.branchId, data.financialYearId, paymentDate);
  const bankAccount = await getBankAccount(data.companyId, lending.branchId, data.bankAccountId);
  const principalAmount = money(data.principalAmount);
  const interestAmount = money(data.interestAmount);
  const totalAmount = money(principalAmount + interestAmount);
  if (totalAmount <= 0) throw fail('Repayment total must be greater than zero', 400, 'INVALID_REPAYMENT_TOTAL');
  if (principalAmount - lending.principalOutstanding > EPSILON) {
    throw fail('Principal repayment exceeds the outstanding principal balance', 409, 'PRINCIPAL_REPAYMENT_EXCEEDS_BALANCE');
  }

  const interestAccount = interestAmount > 0
    ? await ensureIncomeLedger(data.companyId, 'Interest Income', 'lending:interest-income')
    : null;
  const repaymentJournal = await journalService.createJournalEntry({
    companyId: data.companyId,
    branchId: lending.branchId,
    financialYearId: data.financialYearId,
    entryDate: paymentDate,
    reference: data.reference || `LEND-REPAY-${id(lending._id).slice(-6).toUpperCase()}`,
    narration: `Loan repayment from ${lending.customerName}`,
    entrySource: 'AUTOMATIC',
    lines: [
      { accountId: bankAccount.coaAccountId, debit: totalAmount, credit: 0, remarks: 'Loan repayment received' },
      ...(principalAmount > 0 ? [{ accountId: lending.receivableAccountId, debit: 0, credit: principalAmount, remarks: 'Loan principal repaid' }] : []),
      ...(interestAmount > 0 ? [{ accountId: interestAccount._id, debit: 0, credit: interestAmount, remarks: 'Lending interest income' }] : []),
    ],
  }, userId);

  let updatedLending;
  try {
    updatedLending = await Lending.findOneAndUpdate(
      {
        _id: lending._id,
        companyId: data.companyId,
        status: 'ACTIVE',
        principalOutstanding: lending.principalOutstanding,
      },
      {
        $inc: {
          principalOutstanding: -principalAmount,
          totalPrincipalRepaid: principalAmount,
          totalInterestReceived: interestAmount,
        },
        $push: {
          repayments: {
            financialYearId: data.financialYearId,
            paymentDate,
            principalAmount,
            interestAmount,
            totalAmount,
            bankAccountId: bankAccount._id,
            bankAccountName: bankAccount.accountName,
            reference: data.reference || '',
            notes: data.notes || '',
            journalEntryId: repaymentJournal._id,
            createdBy: userId,
          },
        },
        $set: { updatedBy: userId },
      },
      { new: true, runValidators: true },
    );
    if (!updatedLending) throw fail('Lending balance changed before repayment was recorded. Refresh and retry.', 409, 'LENDING_BALANCE_CHANGED');
    if (updatedLending.principalOutstanding <= EPSILON) {
      updatedLending.principalOutstanding = 0;
      updatedLending.status = 'PAID_OFF';
      updatedLending.updatedBy = userId;
      await updatedLending.save();
    }
  } catch (error) {
    await reverseJournalOrThrow(repaymentJournal, userId, error);
    throw error;
  }

  return shape(updatedLending, true);
};

module.exports = { createLending, listLendings, getLending, createRepayment, shape };
