const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Branch = require('../models/Branch');
const FinancialYear = require('../models/FinancialYear');
const BankAccount = require('../models/BankAccount');
const ChartOfAccount = require('../models/ChartOfAccount');
const coaService = require('./coa.service');
const bankAccountService = require('./bankAccount.service');
const journalService = require('./journalEntry.service');
const { ensureExpenseLedger } = require('./autoCoaMapping.service');

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
  const dateValueAsDate = new Date(dateValue);
  if (dateValueAsDate < financialYear.startDate || dateValueAsDate > financialYear.endDate) {
    throw fail('Transaction date must fall within the selected financial year', 400, 'DATE_OUTSIDE_FINANCIAL_YEAR');
  }
  return financialYear;
};

const getBankAccount = async (companyId, branchId, bankAccountId) => {
  const account = await BankAccount.findOne({
    _id: bankAccountId,
    companyId,
    isActive: true,
    branchId: { $in: [branchId, null] }
  });
  if (!account) throw fail('Active bank or cash account not found for this company and branch', 404, 'BANK_ACCOUNT_NOT_FOUND');
  return account;
};

const createLoanLedger = async (loan) => {
  const mappingKey = `loan-liability:${id(loan._id)}`;
  const findMapped = () => ChartOfAccount.findOne({ companyId: loan.companyId, autoMapKey: mappingKey, isGroup: false });
  const existing = await findMapped();
  if (existing) {
    if (existing.isActive === false) throw fail(`Loan liability account "${existing.name}" is inactive`, 409, 'LOAN_ACCOUNT_INACTIVE');
    return existing;
  }

  const parent = await ChartOfAccount.findOne({
    companyId: loan.companyId,
    branchId: null,
    code: '2210',
    type: 'Liability',
    isGroup: true,
    isActive: true
  });
  if (!parent) {
    throw fail('Default Loans (Liability) COA group is unavailable. Seed the Chart of Accounts first.', 409, 'LOAN_COA_GROUP_UNAVAILABLE');
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await coaService.generateNextCode(loan.companyId, 'Liability');
    try {
      return await ChartOfAccount.create({
        companyId: loan.companyId,
        branchId: null,
        name: `Loan Payable - ${loan.lenderName} (${id(loan._id).slice(-6).toUpperCase()})`,
        code,
        type: 'Liability',
        isGroup: false,
        parentId: parent._id,
        autoMapKey: mappingKey,
        isActive: true,
        openingBalance: 0,
        openingBalanceType: 'Cr',
        isSystemAccount: false
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const mapped = await findMapped();
      if (mapped) return mapped;
      if (attempt === 4) throw error;
    }
  }
  throw fail('Unable to allocate a loan liability account', 500, 'LOAN_ACCOUNT_CREATION_FAILED');
};

const maskAccount = (last4) => last4 ? `••••${last4}` : '';
const shape = (document, detail = false) => {
  const loan = typeof document.toObject === 'function' ? document.toObject() : document;
  return {
    id: id(loan._id || loan.id),
    companyId: id(loan.companyId),
    branchId: id(loan.branchId),
    financialYearId: id(loan.financialYearId),
    lenderType: loan.lenderType,
    lenderName: loan.lenderName,
    lenderPhone: loan.lenderPhone || '',
    lenderEmail: loan.lenderEmail || '',
    lenderBankName: loan.lenderBankName || '',
    lenderAccountNumberMasked: maskAccount(loan.lenderAccountNumberLast4),
    lenderIfscCode: loan.lenderIfscCode || '',
    loanReference: loan.loanReference || '',
    principalAmount: loan.principalAmount,
    principalOutstanding: loan.principalOutstanding,
    annualInterestRatePercent: loan.annualInterestRatePercent,
    startDate: loan.startDate,
    maturityDate: loan.maturityDate || null,
    disbursementBankAccountId: id(loan.disbursementBankAccountId),
    disbursementAccountName: loan.disbursementAccountName || '',
    liabilityAccountId: id(loan.liabilityAccountId),
    initialJournalEntryId: id(loan.initialJournalEntryId),
    totalPrincipalRepaid: loan.totalPrincipalRepaid || 0,
    totalInterestPaid: loan.totalInterestPaid || 0,
    status: loan.status,
    notes: loan.notes || '',
    repaymentCount: (loan.repayments || []).length,
    ...(detail ? {
      repayments: (loan.repayments || []).map((repayment) => ({
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
        journalEntryId: id(repayment.journalEntryId),
        createdAt: repayment.createdAt
      }))
    } : {}),
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt
  };
};

const reverseJournalOrThrow = async (entry, userId, originalError) => {
  try {
    await journalService.reverseJournalEntry(entry._id, userId);
  } catch (reversalError) {
    throw fail(
      `${originalError.message || 'Loan transaction could not be completed.'} The journal entry ${entry._id} also could not be reversed: ${reversalError.message}`,
      500,
      'LOAN_JOURNAL_ROLLBACK_FAILED'
    );
  }
};

const createLoan = async (data, userId) => {
  const startDate = new Date(data.startDate);
  await validatePeriod(data.companyId, data.branchId, data.financialYearId, startDate);
  const disbursementAccount = await getBankAccount(data.companyId, data.branchId, data.disbursementBankAccountId);
  if (data.lenderType === 'BANK' && !String(data.lenderBankName || '').trim()) {
    throw fail('Bank name is required for a bank lender', 400, 'LENDER_BANK_NAME_REQUIRED');
  }
  if (data.maturityDate && new Date(data.maturityDate) <= startDate) {
    throw fail('Maturity date must be after the loan start date', 400, 'INVALID_MATURITY_DATE');
  }

  const accountNumber = String(data.lenderAccountNumber || '').trim();
  const loan = await Loan.create({
    ...data,
    startDate,
    maturityDate: data.maturityDate ? new Date(data.maturityDate) : null,
    lenderAccountNumber: accountNumber,
    lenderAccountNumberLast4: accountNumber.slice(-4),
    principalAmount: money(data.principalAmount),
    principalOutstanding: money(data.principalAmount),
    status: 'ACTIVE',
    disbursementAccountName: disbursementAccount.accountName,
    createdBy: userId,
    updatedBy: userId
  });

  let initialJournal = null;
  try {
    const liabilityAccount = await createLoanLedger(loan);
    initialJournal = await journalService.createJournalEntry({
      companyId: data.companyId,
      branchId: data.branchId,
      financialYearId: data.financialYearId,
      entryDate: startDate,
      reference: data.loanReference || `LOAN-${id(loan._id).slice(-8).toUpperCase()}`,
      narration: `Loan received from ${data.lenderName}`,
      entrySource: 'AUTOMATIC',
      lines: [
        { accountId: disbursementAccount.coaAccountId, debit: loan.principalAmount, credit: 0, remarks: 'Loan proceeds received' },
        { accountId: liabilityAccount._id, debit: 0, credit: loan.principalAmount, remarks: 'Loan liability recognized' }
      ]
    }, userId);
    loan.liabilityAccountId = liabilityAccount._id;
    loan.initialJournalEntryId = initialJournal._id;
    await loan.save();
    return shape(loan, true);
  } catch (error) {
    if (initialJournal) await reverseJournalOrThrow(initialJournal, userId, error);
    await Loan.deleteOne({ _id: loan._id });
    throw error;
  }
};

const listLoans = async (query) => {
  const filter = { companyId: query.companyId };
  if (query.branchId) filter.branchId = query.branchId;
  if (query.status) filter.status = query.status;
  if (query.lenderType) filter.lenderType = query.lenderType;
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [
      { lenderName: pattern },
      { lenderBankName: pattern },
      { loanReference: pattern }
    ];
  }
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const [records, total] = await Promise.all([
    Loan.find(filter).sort({ startDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Loan.countDocuments(filter)
  ]);
  return { items: records.map((record) => shape(record)), pagination: { page, limit, total } };
};

const getLoan = async (loanId, companyId) => {
  if (!mongoose.isValidObjectId(loanId)) throw fail('Loan not found', 404, 'LOAN_NOT_FOUND');
  const loan = await Loan.findOne({ _id: loanId, companyId }).lean();
  if (!loan) throw fail('Loan not found', 404, 'LOAN_NOT_FOUND');
  return shape(loan, true);
};

const createRepayment = async (loanId, data, userId) => {
  if (!mongoose.isValidObjectId(loanId)) throw fail('Loan not found', 404, 'LOAN_NOT_FOUND');
  const loan = await Loan.findOne({ _id: loanId, companyId: data.companyId });
  if (!loan) throw fail('Loan not found', 404, 'LOAN_NOT_FOUND');
  if (loan.status !== 'ACTIVE') throw fail('A paid-off loan cannot receive further repayments', 409, 'LOAN_ALREADY_PAID_OFF');

  const paymentDate = new Date(data.paymentDate);
  await validatePeriod(data.companyId, loan.branchId, data.financialYearId, paymentDate);
  const bankAccount = await getBankAccount(data.companyId, loan.branchId, data.bankAccountId);
  const principalAmount = money(data.principalAmount);
  const interestAmount = money(data.interestAmount);
  const totalAmount = money(principalAmount + interestAmount);
  if (totalAmount <= 0) throw fail('Repayment total must be greater than zero', 400, 'INVALID_REPAYMENT_TOTAL');
  if (principalAmount - loan.principalOutstanding > EPSILON) {
    throw fail('Principal repayment exceeds the outstanding principal balance', 409, 'PRINCIPAL_REPAYMENT_EXCEEDS_BALANCE');
  }

  const availableBalance = Number(await bankAccountService.getAccountBalance(bankAccount.coaAccountId));
  if (!Number.isFinite(availableBalance)) {
    throw fail('Could not verify the selected account balance. Try again before recording repayment.', 503, 'ACCOUNT_BALANCE_UNAVAILABLE');
  }
  if (availableBalance + EPSILON < totalAmount) {
    throw fail(
      `Insufficient funds in ${bankAccount.accountName}. Available: ${Math.max(availableBalance, 0).toFixed(2)}; required: ${totalAmount.toFixed(2)}.`,
      409,
      'INSUFFICIENT_FUNDS'
    );
  }

  const interestAccount = interestAmount > 0
    ? await ensureExpenseLedger(data.companyId, 'Interest Expense')
    : null;
  const lines = [
    ...(principalAmount > 0 ? [{
      accountId: loan.liabilityAccountId,
      debit: principalAmount,
      credit: 0,
      remarks: 'Loan principal repaid'
    }] : []),
    ...(interestAmount > 0 ? [{
      accountId: interestAccount._id,
      debit: interestAmount,
      credit: 0,
      remarks: 'Loan interest expense'
    }] : []),
    { accountId: bankAccount.coaAccountId, debit: 0, credit: totalAmount, remarks: 'Loan repayment from bank/cash' }
  ];
  const repaymentJournal = await journalService.createJournalEntry({
    companyId: data.companyId,
    branchId: loan.branchId,
    financialYearId: data.financialYearId,
    entryDate: paymentDate,
    reference: data.reference || `LOAN-REPAY-${id(loan._id).slice(-6).toUpperCase()}`,
    narration: `Loan repayment to ${loan.lenderName}`,
    entrySource: 'AUTOMATIC',
    lines
  }, userId);

  let updatedLoan;
  try {
    updatedLoan = await Loan.findOneAndUpdate(
      {
        _id: loan._id,
        companyId: data.companyId,
        status: 'ACTIVE',
        principalOutstanding: loan.principalOutstanding
      },
      {
        $inc: {
          principalOutstanding: -principalAmount,
          totalPrincipalRepaid: principalAmount,
          totalInterestPaid: interestAmount
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
            createdBy: userId
          }
        },
        $set: { updatedBy: userId }
      },
      { new: true, runValidators: true }
    );
    if (!updatedLoan) throw fail('Loan balance changed before repayment was recorded. Refresh and retry.', 409, 'LOAN_BALANCE_CHANGED');
    if (updatedLoan.principalOutstanding <= EPSILON) {
      updatedLoan.principalOutstanding = 0;
      updatedLoan.status = 'PAID_OFF';
      updatedLoan.updatedBy = userId;
      await updatedLoan.save();
    }
  } catch (error) {
    await reverseJournalOrThrow(repaymentJournal, userId, error);
    throw error;
  }

  return shape(updatedLoan, true);
};

module.exports = { createLoan, listLoans, getLoan, createRepayment, shape };
