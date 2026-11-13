const express = require('express');
const {
  createAccount,
  listAccounts,
  getAccountDetails,
  updateAccount,
  deleteAccount,
  seedDefaultCoaRoute,
  getAccountLedgerRoute
} = require('../controllers/coa.controller');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const validateRequest = require('../middleware/validateRequest');
const {
  READ_ROLES,
  WRITE_ROLES,
  requireFinanceCompanyAccess,
  requireFinanceRole
} = require('../middleware/financeAccess');
const { createCoaSchema, updateCoaSchema } = require('../validators/coa.validators');

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticate);

/**
 * @openapi
 * /api/coa/{id}/ledger:
 *   get:
 *     summary: Fetch ledger history for a Chart of Account
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/ledger', checkCompanyAccess, requireFinanceCompanyAccess, requireFinanceRole(READ_ROLES), getAccountLedgerRoute);

/**
 * @openapi
 * /api/coa:
 *   post:
 *     summary: Create a custom account
 *     description: Adds a new group or ledger account under a company.
 *     security:
 *       - bearerAuth: []
 */
router.post('/', validateRequest(createCoaSchema), checkCompanyAccess, requireFinanceCompanyAccess, requireFinanceRole(WRITE_ROLES), createAccount);

/**
 * @openapi
 * /api/coa:
 *   get:
 *     summary: List all accounts
 *     description: Returns flat list or nested tree of accounts.
 *     security:
 *       - bearerAuth: []
 */
router.get('/', checkCompanyAccess, requireFinanceCompanyAccess, requireFinanceRole(READ_ROLES), listAccounts);

/**
 * @openapi
 * /api/coa/seed-default:
 *   post:
 *     summary: Seed default Chart of Accounts
 *     description: Seed the standard default accounts for a new company.
 *     security:
 *       - bearerAuth: []
 */
router.post('/seed-default', checkCompanyAccess, requireFinanceCompanyAccess, requireFinanceRole(WRITE_ROLES), seedDefaultCoaRoute);

/**
 * @openapi
 * /api/coa/{id}:
 *   get:
 *     summary: Get single account details
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', checkCompanyAccess, requireFinanceCompanyAccess, requireFinanceRole(READ_ROLES), getAccountDetails);

/**
 * @openapi
 * /api/coa/{id}:
 *   put:
 *     summary: Update an account
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', checkCompanyAccess, requireFinanceCompanyAccess, requireFinanceRole(WRITE_ROLES), validateRequest(updateCoaSchema), updateAccount);

/**
 * @openapi
 * /api/coa/{id}:
 *   delete:
 *     summary: Delete an account (soft delete)
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', checkCompanyAccess, requireFinanceCompanyAccess, requireFinanceRole(WRITE_ROLES), deleteAccount);

module.exports = router;
