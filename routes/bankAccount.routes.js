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
const {
  BANK_READ_ROLES,
  WRITE_ROLES,
  requireFinanceCompanyAccess,
  requireFinanceRole
} = require('../middleware/financeAccess');

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticate);

// 1. Add a new bank/cash/wallet/card account
router.post(
  '/',
  validateRequest(createBankAccountSchema),
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(WRITE_ROLES),
  createBankAccount
);

// 2. List all accounts for a company
router.get(
  '/',
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(BANK_READ_ROLES),
  listBankAccounts
);

// --- Inter-Account Transfers & Fund Plus/Minus Routes ---
// (Must be defined before /:id routes)

// Execute Inter-Account Transfer (Bank to Bank, Bank to Cash, Cash to Bank, Cash to Cash)
router.post(
  '/transfer',
  validateRequest(transferSchema),
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(WRITE_ROLES),
  createTransfer
);

// Execute Fund Plus (Direct Deposit / Income into Bank/Cash account)
router.post(
  '/fund-plus',
  validateRequest(fundPlusSchema),
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(WRITE_ROLES),
  createFundPlus
);

// Execute Fund Minus (Direct Withdrawal / Expense from Bank/Cash account)
router.post(
  '/fund-minus',
  validateRequest(fundMinusSchema),
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(WRITE_ROLES),
  createFundMinus
);

// List all account transfers / fund movements for a company
router.get(
  '/transfers',
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(BANK_READ_ROLES),
  listTransfers
);

// Get single transfer transaction details
router.get(
  '/transfers/:id',
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(BANK_READ_ROLES),
  getTransferDetails
);

// Cancel / Reverse a transfer transaction
router.post(
  '/transfers/:id/cancel',
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(WRITE_ROLES),
  cancelTransfer
);

// --- Single Account Operations ---

// 3. Single account + current balance
router.get(
  '/:id',
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(BANK_READ_ROLES),
  getBankAccountDetails
);

// 4. Update account details
router.put(
  '/:id',
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(WRITE_ROLES),
  validateRequest(updateBankAccountSchema),
  updateBankAccount
);

// 5. Account's ledger/transaction history
router.get(
  '/:id/ledger',
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(BANK_READ_ROLES),
  getAccountLedger
);

// 6. Reconcile against statement lines
router.post(
  '/:id/reconcile',
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(WRITE_ROLES),
  validateRequest(reconcileSchema),
  reconcileAccount
);

// 7. Delete a bank account (only admins can perform this action)
router.delete(
  '/:id',
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(WRITE_ROLES),
  requireAdmin,
  deleteBankAccount
);

module.exports = router;
