const express = require('express');
const {
  createBankAccount,
  listBankAccounts,
  getBankAccountDetails,
  updateBankAccount,
  getAccountLedger,
  reconcileAccount,
  deleteBankAccount
} = require('../controllers/bankAccount.controller');
const {
  createTransfer,
  createFundPlus,
  createFundMinus,
  listTransfers,
  getTransferDetails,
  cancelTransfer
} = require('../controllers/accountTransfer.controller');

const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const requireAdmin = require('../middleware/requireAdmin');
const validateRequest = require('../middleware/validateRequest');
const {
  createBankAccountSchema,
  updateBankAccountSchema,
  reconcileSchema
} = require('../validators/bankAccount.validators');
const {
  transferSchema,
  fundPlusSchema,
  fundMinusSchema
} = require('../validators/accountTransfer.validators');

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticate);

// 1. Add a new bank/cash/wallet/card account
router.post(
  '/',
  validateRequest(createBankAccountSchema),
  checkCompanyAccess,
  createBankAccount
);

// 2. List all accounts for a company
router.get(
  '/',
  checkCompanyAccess,
  listBankAccounts
);

// --- Inter-Account Transfers & Fund Plus/Minus Routes ---
// (Must be defined before /:id routes)

// Execute Inter-Account Transfer (Bank to Bank, Bank to Cash, Cash to Bank, Cash to Cash)
router.post(
  '/transfer',
  validateRequest(transferSchema),
  checkCompanyAccess,
  createTransfer
);

// Execute Fund Plus (Direct Deposit / Income into Bank/Cash account)
router.post(
  '/fund-plus',
  validateRequest(fundPlusSchema),
  checkCompanyAccess,
  createFundPlus
);

// Execute Fund Minus (Direct Withdrawal / Expense from Bank/Cash account)
router.post(
  '/fund-minus',
  validateRequest(fundMinusSchema),
  checkCompanyAccess,
  createFundMinus
);

// List all account transfers / fund movements for a company
router.get(
  '/transfers',
  checkCompanyAccess,
  listTransfers
);

// Get single transfer transaction details
router.get(
  '/transfers/:id',
  checkCompanyAccess,
  getTransferDetails
);

// Cancel / Reverse a transfer transaction
router.post(
  '/transfers/:id/cancel',
  checkCompanyAccess,
  cancelTransfer
);

// --- Single Account Operations ---

// 3. Single account + current balance
router.get(
  '/:id',
  checkCompanyAccess,
  getBankAccountDetails
);

// 4. Update account details
router.put(
  '/:id',
  checkCompanyAccess,
  validateRequest(updateBankAccountSchema),
  updateBankAccount
);

// 5. Account's ledger/transaction history
router.get(
  '/:id/ledger',
  checkCompanyAccess,
  getAccountLedger
);

// 6. Reconcile against statement lines
router.post(
  '/:id/reconcile',
  checkCompanyAccess,
  validateRequest(reconcileSchema),
  reconcileAccount
);

// 7. Delete a bank account (only admins can perform this action)
router.delete(
  '/:id',
  checkCompanyAccess,
  requireAdmin,
  deleteBankAccount
);

module.exports = router;
