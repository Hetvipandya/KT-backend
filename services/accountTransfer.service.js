const mongoose = require('mongoose');
const BankAccount = require('../models/BankAccount');
const ChartOfAccount = require('../models/ChartOfAccount');
const FinancialYear = require('../models/FinancialYear');
const AccountTransfer = require('../models/AccountTransfer');
const journalEntryService = require('./journalEntry.service');
const auditLogService = require('./auditLog.service');

const serviceError = (message, statusCode, errorCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
};

/**
 * Helper to determine Financial Year ID for a date
 */
const resolveFinancialYear = async (companyId, date) => {
  const targetDate = new Date(date);
  const fy = await FinancialYear.findOne({
    companyId,
    startDate: { $lte: targetDate },
    endDate: { $gte: targetDate }
  }).lean();

  if (!fy) {
    throw serviceError(`No financial year found for date ${targetDate.toISOString().split('T')[0]}`, 400, 'FINANCIAL_YEAR_NOT_FOUND');
  }
  if (fy.isLocked) {
    throw serviceError('Cannot post transactions to a locked financial year', 409, 'FINANCIAL_YEAR_LOCKED');
  }
  return fy._id;
};

/**
 * Determine transfer type based on account categories
 */
const determineTransferType = (fromAccountType, toAccountType) => {
  const isFromCash = ['Cash', 'Wallet'].includes(fromAccountType);
  const isToCash = ['Cash', 'Wallet'].includes(toAccountType);

  if (isFromCash && isToCash) return 'CASH_TO_CASH';
  if (isFromCash && !isToCash) return 'CASH_TO_BANK';
  if (!isFromCash && isToCash) return 'BANK_TO_CASH';
  return 'BANK_TO_BANK';
};

/**
 * Execute Inter-Account Transfer (Bank-to-Bank, Bank-to-Cash, Cash-to-Bank, Cash-to-Cash)
 */
const createTransfer = async (payload, userId) => {
  const {
    companyId,
    branchId,
    fromAccountId,
    toAccountId,
    amount,
    transferDate,
    paymentMode,
    referenceNo,
    narration
  } = payload;

  const date = transferDate ? new Date(transferDate) : new Date();

  // Validate accounts
  const fromAccount = await BankAccount.findOne({ _id: fromAccountId, companyId, isActive: true });
  if (!fromAccount) {
    throw serviceError('Source bank/cash account not found or inactive', 444, 'FROM_ACCOUNT_NOT_FOUND');
  }

  const toAccount = await BankAccount.findOne({ _id: toAccountId, companyId, isActive: true });
  if (!toAccount) {
    throw serviceError('Destination bank/cash account not found or inactive', 404, 'TO_ACCOUNT_NOT_FOUND');
  }

  if (fromAccountId.toString() === toAccountId.toString()) {
    throw serviceError('Source and destination accounts must be different', 400, 'SAME_ACCOUNT_TRANSFER');
  }

  const transferType = determineTransferType(fromAccount.accountType, toAccount.accountType);
  const financialYearId = await resolveFinancialYear(companyId, date);

  const transferNarration = narration || `Inter-account transfer (${fromAccount.accountName} -> ${toAccount.accountName})`;

  // 1. Create balanced Journal Entry
  const journalPayload = {
    companyId,
    branchId: branchId || fromAccount.branchId || null,
    financialYearId,
    entryDate: date,
    reference: referenceNo || `TRF-${Date.now()}`,
    narration: transferNarration,
    lines: [
      {
        accountId: toAccount.coaAccountId,
        debit: amount,
        credit: 0,
        remarks: `Received from ${fromAccount.accountName}`
      },
      {
        accountId: fromAccount.coaAccountId,
        debit: 0,
        credit: amount,
        remarks: `Transferred to ${toAccount.accountName}`
      }
    ]
  };

  const journalEntry = await journalEntryService.createJournalEntry(journalPayload, userId);

  // 2. Save AccountTransfer record
  const transferRecord = await AccountTransfer.create({
    companyId,
    branchId: branchId || fromAccount.branchId || null,
    financialYearId,
    transferType,
    fromAccountId: fromAccount._id,
    toAccountId: toAccount._id,
    amount,
    transferDate: date,
    paymentMode: paymentMode || 'Other',
    referenceNo: referenceNo || '',
    narration: transferNarration,
    journalEntryId: journalEntry._id,
    status: 'Completed',
    createdBy: userId,
    updatedBy: userId
  });

  // 3. Record Audit Log
  await auditLogService.recordAuditEvent({
    companyId,
    branchId: branchId || null,
    userId,
    module: 'BankManagement',
    actionType: 'ACCOUNT_TRANSFER_CREATE',
    entityId: transferRecord._id.toString(),
    entityType: 'AccountTransfer',
    description: `Inter-account transfer of ₹${amount} from ${fromAccount.accountName} to ${toAccount.accountName} (${transferType})`,
    metadata: {
      fromAccountId: fromAccount._id,
      toAccountId: toAccount._id,
      amount,
      transferType,
      journalEntryId: journalEntry._id
    }
  });

  return AccountTransfer.findById(transferRecord._id)
    .populate('fromAccountId', 'accountName accountType bankName')
    .populate('toAccountId', 'accountName accountType bankName')
    .populate('journalEntryId')
    .lean();
};

/**
 * Execute Fund Plus (Direct deposit into a Bank/Cash account)
 */
const createFundPlus = async (payload, userId) => {
  const {
    companyId,
    branchId,
    toAccountId,
    contraAccountId,
    amount,
    transferDate,
    paymentMode,
    referenceNo,
    narration
  } = payload;

  const date = transferDate ? new Date(transferDate) : new Date();

  const toAccount = await BankAccount.findOne({ _id: toAccountId, companyId, isActive: true });
  if (!toAccount) {
    throw serviceError('Target bank/cash account not found or inactive', 404, 'TO_ACCOUNT_NOT_FOUND');
  }

  const contraCOA = await ChartOfAccount.findOne({ _id: contraAccountId, companyId, isActive: true, isGroup: false });
  if (!contraCOA) {
    throw serviceError('Source ledger (contraAccountId) account not found, inactive, or is a group account', 404, 'CONTRA_ACCOUNT_INVALID');
  }

  const financialYearId = await resolveFinancialYear(companyId, date);
  const plusNarration = narration || `Fund Plus to ${toAccount.accountName} from ${contraCOA.name}`;

  // 1. Create Journal Entry
  const journalPayload = {
    companyId,
    branchId: branchId || toAccount.branchId || null,
    financialYearId,
    entryDate: date,
    reference: referenceNo || `FPLUS-${Date.now()}`,
    narration: plusNarration,
    lines: [
      {
        accountId: toAccount.coaAccountId,
        debit: amount,
        credit: 0,
        remarks: `Fund deposit to ${toAccount.accountName}`
      },
      {
        accountId: contraCOA._id,
        debit: 0,
        credit: amount,
        remarks: `Source ledger: ${contraCOA.name}`
      }
    ]
  };

  const journalEntry = await journalEntryService.createJournalEntry(journalPayload, userId);

  // 2. Save AccountTransfer record
  const transferRecord = await AccountTransfer.create({
    companyId,
    branchId: branchId || toAccount.branchId || null,
    financialYearId,
    transferType: 'FUND_PLUS',
    fromAccountId: null,
    toAccountId: toAccount._id,
    contraAccountId: contraCOA._id,
    amount,
    transferDate: date,
    paymentMode: paymentMode || 'Other',
    referenceNo: referenceNo || '',
    narration: plusNarration,
    journalEntryId: journalEntry._id,
    status: 'Completed',
    createdBy: userId,
    updatedBy: userId
  });

  // 3. Record Audit Log
  await auditLogService.recordAuditEvent({
    companyId,
    branchId: branchId || null,
    userId,
    module: 'BankManagement',
    actionType: 'FUND_PLUS_CREATE',
    entityId: transferRecord._id.toString(),
    entityType: 'AccountTransfer',
    description: `Fund Plus of ₹${amount} added to ${toAccount.accountName} from ${contraCOA.name}`,
    metadata: {
      toAccountId: toAccount._id,
      contraAccountId: contraCOA._id,
      amount,
      journalEntryId: journalEntry._id
    }
  });

  return AccountTransfer.findById(transferRecord._id)
    .populate('toAccountId', 'accountName accountType bankName')
    .populate('contraAccountId', 'name code type')
    .populate('journalEntryId')
    .lean();
};

/**
 * Execute Fund Minus (Direct deduction from a Bank/Cash account)
 */
const createFundMinus = async (payload, userId) => {
  const {
    companyId,
    branchId,
    fromAccountId,
    contraAccountId,
    amount,
    transferDate,
    paymentMode,
    referenceNo,
    narration
  } = payload;

  const date = transferDate ? new Date(transferDate) : new Date();

  const fromAccount = await BankAccount.findOne({ _id: fromAccountId, companyId, isActive: true });
  if (!fromAccount) {
    throw serviceError('Source bank/cash account not found or inactive', 404, 'FROM_ACCOUNT_NOT_FOUND');
  }

  const contraCOA = await ChartOfAccount.findOne({ _id: contraAccountId, companyId, isActive: true, isGroup: false });
  if (!contraCOA) {
    throw serviceError('Destination ledger (contraAccountId) account not found, inactive, or is a group account', 404, 'CONTRA_ACCOUNT_INVALID');
  }

  const financialYearId = await resolveFinancialYear(companyId, date);
  const minusNarration = narration || `Fund Minus from ${fromAccount.accountName} to ${contraCOA.name}`;

  // 1. Create Journal Entry
  const journalPayload = {
    companyId,
    branchId: branchId || fromAccount.branchId || null,
    financialYearId,
    entryDate: date,
    reference: referenceNo || `FMINUS-${Date.now()}`,
    narration: minusNarration,
    lines: [
      {
        accountId: contraCOA._id,
        debit: amount,
        credit: 0,
        remarks: `Destination ledger: ${contraCOA.name}`
      },
      {
        accountId: fromAccount.coaAccountId,
        debit: 0,
        credit: amount,
        remarks: `Fund withdrawal from ${fromAccount.accountName}`
      }
    ]
  };

  const journalEntry = await journalEntryService.createJournalEntry(journalPayload, userId);

  // 2. Save AccountTransfer record
  const transferRecord = await AccountTransfer.create({
    companyId,
    branchId: branchId || fromAccount.branchId || null,
    financialYearId,
    transferType: 'FUND_MINUS',
    fromAccountId: fromAccount._id,
    toAccountId: null,
    contraAccountId: contraCOA._id,
    amount,
    transferDate: date,
    paymentMode: paymentMode || 'Other',
    referenceNo: referenceNo || '',
    narration: minusNarration,
    journalEntryId: journalEntry._id,
    status: 'Completed',
    createdBy: userId,
    updatedBy: userId
  });

  // 3. Record Audit Log
  await auditLogService.recordAuditEvent({
    companyId,
    branchId: branchId || null,
    userId,
    module: 'BankManagement',
    actionType: 'FUND_MINUS_CREATE',
    entityId: transferRecord._id.toString(),
    entityType: 'AccountTransfer',
    description: `Fund Minus of ₹${amount} deducted from ${fromAccount.accountName} to ${contraCOA.name}`,
    metadata: {
      fromAccountId: fromAccount._id,
      contraAccountId: contraCOA._id,
      amount,
      journalEntryId: journalEntry._id
    }
  });

  return AccountTransfer.findById(transferRecord._id)
    .populate('fromAccountId', 'accountName accountType bankName')
    .populate('contraAccountId', 'name code type')
    .populate('journalEntryId')
    .lean();
};

/**
 * List transfers for a company with filters
 */
const listTransfers = async (companyId, { branchId, transferType, accountId, from, to, status } = {}) => {
  const filter = { companyId };

  if (branchId) filter.branchId = branchId;
  if (transferType) filter.transferType = transferType;
  if (status) filter.status = status;

  if (accountId) {
    filter.$or = [
      { fromAccountId: accountId },
      { toAccountId: accountId }
    ];
  }

  if (from || to) {
    filter.transferDate = {};
    if (from) filter.transferDate.$gte = new Date(from);
    if (to) filter.transferDate.$lte = new Date(to);
  }

  return AccountTransfer.find(filter)
    .sort({ transferDate: -1, createdAt: -1 })
    .populate('fromAccountId', 'accountName accountType bankName')
    .populate('toAccountId', 'accountName accountType bankName')
    .populate('contraAccountId', 'name code type')
    .populate('journalEntryId')
    .lean();
};

/**
 * Get transfer details by ID
 */
const getTransferById = async (id, companyId) => {
  if (!mongoose.isValidObjectId(id)) return null;

  return AccountTransfer.findOne({ _id: id, companyId })
    .populate('fromAccountId', 'accountName accountType bankName')
    .populate('toAccountId', 'accountName accountType bankName')
    .populate('contraAccountId', 'name code type')
    .populate('journalEntryId')
    .lean();
};

/**
 * Cancel / Reverse a Transfer transaction
 */
const cancelTransfer = async (id, companyId, userId) => {
  if (!mongoose.isValidObjectId(id)) {
    throw serviceError('Transfer transaction not found', 404, 'TRANSFER_NOT_FOUND');
  }

  const transfer = await AccountTransfer.findOne({ _id: id, companyId });
  if (!transfer) {
    throw serviceError('Transfer transaction not found', 404, 'TRANSFER_NOT_FOUND');
  }

  if (transfer.status === 'Cancelled') {
    throw serviceError('Transfer transaction has already been cancelled', 409, 'TRANSFER_ALREADY_CANCELLED');
  }

  // Reverse linked journal entry
  const { reversal } = await journalEntryService.reverseJournalEntry(transfer.journalEntryId, userId);

  transfer.status = 'Cancelled';
  transfer.updatedBy = userId;
  await transfer.save();

  // Audit Log
  await auditLogService.recordAuditEvent({
    companyId,
    branchId: transfer.branchId || null,
    userId,
    module: 'BankManagement',
    actionType: 'ACCOUNT_TRANSFER_CANCEL',
    entityId: transfer._id.toString(),
    entityType: 'AccountTransfer',
    description: `Cancelled ${transfer.transferType} transaction of ₹${transfer.amount}`,
    metadata: {
      transferId: transfer._id,
      reversalJournalEntryId: reversal._id
    }
  });

  return AccountTransfer.findById(transfer._id)
    .populate('fromAccountId', 'accountName accountType bankName')
    .populate('toAccountId', 'accountName accountType bankName')
    .populate('contraAccountId', 'name code type')
    .populate('journalEntryId')
    .lean();
};

module.exports = {
  createTransfer,
  createFundPlus,
  createFundMinus,
  listTransfers,
  getTransferById,
  cancelTransfer
};
