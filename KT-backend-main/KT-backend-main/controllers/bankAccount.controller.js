const BankAccount = require('../models/BankAccount');
const BankReconciliation = require('../models/BankReconciliation');
const ChartOfAccount = require('../models/ChartOfAccount');
const bankAccountService = require('../services/bankAccount.service');

/**
 * POST /api/bank-account
 * Create a new bank/cash/wallet/card account
 */
const createBankAccount = async (req, res, next) => {
  try {
    const {
      companyId,
      branchId: bodyBranchId,
      accountType,
      accountName,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      openingBalance,
      openingBalanceDate
    } = req.body;

    // Check for duplicate account number within the company
    if (accountNumber && String(accountNumber).trim()) {
      const cleanNumber = String(accountNumber).trim();
      const existingNumber = await BankAccount.findOne({
        companyId,
        accountNumber: cleanNumber,
        isActive: true
      });
      if (existingNumber) {
        return res.status(409).json({
          success: false,
          message: `A bank account with account number "${cleanNumber}" already exists for this company.`,
          errorCode: 'DUPLICATE_ACCOUNT_NUMBER'
        });
      }
    }

    // Check for duplicate account name within the company
    if (accountName && String(accountName).trim()) {
      const cleanName = String(accountName).trim();
      const existingName = await BankAccount.findOne({
        companyId,
        accountName: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        isActive: true
      });
      if (existingName) {
        return res.status(409).json({
          success: false,
          message: `A bank account with name "${cleanName}" already exists for this company.`,
          errorCode: 'DUPLICATE_ACCOUNT_NAME'
        });
      }
    }

    // Auto-create/link corresponding COA ledger account
    const coaAccountId = await bankAccountService.createLinkedCoaAccount(
      companyId,
      accountName,
      accountType,
      openingBalance
    );

    const branchId = bodyBranchId || req.branchId || (req.user && req.user.branchId) || null;

    const bankAccount = await BankAccount.create({
      companyId,
      branchId,
      accountType,
      accountName,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      openingBalance,
      openingBalanceDate,
      coaAccountId,
      isActive: true
    });

    const coaDoc = await ChartOfAccount.findById(coaAccountId).select('name code').lean();

    return res.status(201).json({
      success: true,
      data: {
        ...bankAccount.toObject(),
        coaAccountId: bankAccount.coaAccountId ? bankAccount.coaAccountId.toString() : null,
        coaAccountName: coaDoc?.name || bankAccount.accountName || null,
        coaAccountCode: coaDoc?.code || null,
        coaAccount: coaDoc ? { _id: coaDoc._id.toString(), name: coaDoc.name, code: coaDoc.code } : null,
        currentBalance: bankAccount.openingBalance || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/bank-account
 * List accounts for a company
 */
const listBankAccounts = async (req, res, next) => {
  try {
    const { companyId, includeInactive } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID query parameter is required'
      });
    }

    const filter = { companyId };
    if (req.branchId) {
      filter.$or = [{ branchId: req.branchId }, { branchId: null }];
    }
    if (includeInactive !== 'true') {
      filter.isActive = true;
    }

    // Explicitly select accountNumber so we can mask it in the list view response
    const accounts = await BankAccount.find(filter)
      .select('+accountNumber')
      .populate('branchId', 'branchName')
      .lean();

    const coaIds = accounts.map(a => a.coaAccountId).filter(Boolean);
    const coaDocs = await ChartOfAccount.find({ _id: { $in: coaIds } }).select('name code').lean();
    const coaMap = new Map(coaDocs.map(c => [c._id.toString(), c]));

    const formattedAccounts = await Promise.all(accounts.map(async acc => {
      if (acc.accountNumber) {
        acc.accountNumber = bankAccountService.maskAccountNumber(acc.accountNumber);
      }
      const currentBalance = await bankAccountService.getAccountBalance(acc.coaAccountId);
      const coaIdStr = acc.coaAccountId ? acc.coaAccountId.toString() : '';
      const coaDoc = coaMap.get(coaIdStr);

      const branchName = acc.branchId && typeof acc.branchId === 'object' ? acc.branchId.branchName : null;
      const branchIdStr = acc.branchId ? (acc.branchId._id ? acc.branchId._id.toString() : acc.branchId.toString()) : null;

      return {
        ...acc,
        branchId: branchIdStr,
        branchName,
        coaAccountId: acc.coaAccountId ? acc.coaAccountId.toString() : null,
        coaAccountName: coaDoc?.name || acc.accountName || null,
        coaAccountCode: coaDoc?.code || null,
        coaAccount: coaDoc ? { _id: coaDoc._id.toString(), name: coaDoc.name, code: coaDoc.code } : null,
        currentBalance,
        balance: currentBalance,
        netBalance: currentBalance
      };
    }));

    return res.status(200).json({
      success: true,
      data: formattedAccounts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/bank-account/:id
 * Single account + current balance
 */
const getBankAccountDetails = async (req, res, next) => {
  try {
    // Explicitly select accountNumber for detail view
    const bankAccount = await BankAccount.findById(req.params.id)
      .select('+accountNumber')
      .populate('branchId', 'branchName')
      .lean();

    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    const currentBalance = await bankAccountService.getAccountBalance(bankAccount.coaAccountId);
    let coaDoc = null;
    if (bankAccount.coaAccountId) {
      coaDoc = await ChartOfAccount.findById(bankAccount.coaAccountId).select('name code').lean();
    }

    const branchName = bankAccount.branchId && typeof bankAccount.branchId === 'object' ? bankAccount.branchId.branchName : null;
    const branchIdStr = bankAccount.branchId ? (bankAccount.branchId._id ? bankAccount.branchId._id.toString() : bankAccount.branchId.toString()) : null;

    return res.status(200).json({
      success: true,
      data: {
        ...bankAccount,
        branchId: branchIdStr,
        branchName,
        coaAccountId: bankAccount.coaAccountId ? bankAccount.coaAccountId.toString() : null,
        coaAccountName: coaDoc?.name || bankAccount.accountName || null,
        coaAccountCode: coaDoc?.code || null,
        coaAccount: coaDoc ? { _id: coaDoc._id.toString(), name: coaDoc.name, code: coaDoc.code } : null,
        currentBalance,
        balance: currentBalance,
        netBalance: currentBalance
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/bank-account/:id
 * Update account details
 */
const updateBankAccount = async (req, res, next) => {
  try {
    const bankAccount = req.bankAccount; // loaded and cached by middleware
    const updates = req.body;

    // Reject changes to accountType, accountNumber, or coaAccountId
    if ('accountType' in updates || 'accountNumber' in updates || 'coaAccountId' in updates) {
      return res.status(400).json({
        success: false,
        message: 'accountType, accountNumber, and coaAccountId cannot be changed after creation; deactivate this account and create a new one instead'
      });
    }

    // Update conditional fields
    if (updates.accountName !== undefined) {
      bankAccount.accountName = updates.accountName;
      // Sync COA account name
      await ChartOfAccount.findByIdAndUpdate(bankAccount.coaAccountId, { name: updates.accountName });
    }

    if (updates.bankName !== undefined) bankAccount.bankName = updates.bankName;
    if (updates.ifscCode !== undefined) bankAccount.ifscCode = updates.ifscCode;
    if (updates.branchName !== undefined) bankAccount.branchName = updates.branchName;
    if (updates.branchId !== undefined) bankAccount.branchId = updates.branchId ? updates.branchId : null;

    if (updates.isActive !== undefined) {
      bankAccount.isActive = updates.isActive;
      // Sync COA account active state
      await ChartOfAccount.findByIdAndUpdate(bankAccount.coaAccountId, { isActive: updates.isActive });
    }

    const saved = await bankAccount.save();
    const currentBalance = await bankAccountService.getAccountBalance(saved.coaAccountId);
    const coaDoc = await ChartOfAccount.findById(saved.coaAccountId).select('name code').lean();

    return res.status(200).json({
      success: true,
      data: {
        ...saved.toObject(),
        coaAccountId: saved.coaAccountId ? saved.coaAccountId.toString() : null,
        coaAccountName: coaDoc?.name || saved.accountName || null,
        coaAccountCode: coaDoc?.code || null,
        coaAccount: coaDoc ? { _id: coaDoc._id.toString(), name: coaDoc.name, code: coaDoc.code } : null,
        currentBalance
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/bank-account/:id/ledger
 * Return transaction history for the account's linked COA account
 */
const getAccountLedger = async (req, res, next) => {
  try {
    const bankAccount = req.bankAccount; // loaded and cached by middleware
    const { from, to } = req.query;

    const ledgerData = await bankAccountService.getAccountLedger(
      bankAccount.coaAccountId,
      bankAccount.companyId.toString(),
      { from, to }
    );

    return res.status(200).json({
      success: true,
      data: ledgerData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bank-account/:id/reconcile
 * Reconcile bank statement lines
 */
const reconcileAccount = async (req, res, next) => {
  try {
    const bankAccount = req.bankAccount; // loaded and cached by middleware
    const { statementDate, statementLines } = req.body;

    const processedLines = await bankAccountService.attemptAutoMatch(
      bankAccount.coaAccountId,
      statementLines
    );

    const matchedCount = processedLines.filter(line => line.status === 'matched').length;
    const unmatchedCount = processedLines.filter(line => line.status === 'unmatched').length;

    const reconciliation = await BankReconciliation.create({
      companyId: bankAccount.companyId,
      bankAccountId: bankAccount._id,
      statementDate,
      lines: processedLines
    });

    return res.status(200).json({
      success: true,
      data: {
        reconciliationId: reconciliation._id,
        matchedCount,
        unmatchedCount,
        totalLines: processedLines.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/bank-account/:id
 * Delete a bank/cash account
 */
const deleteBankAccount = async (req, res, next) => {
  try {
    const bankAccount = req.bankAccount; // cached by middleware
    await bankAccount.deleteOne();
    return res.status(200).json({
      success: true,
      message: 'Bank account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBankAccount,
  listBankAccounts,
  getBankAccountDetails,
  updateBankAccount,
  getAccountLedger,
  reconcileAccount,
  deleteBankAccount
};
