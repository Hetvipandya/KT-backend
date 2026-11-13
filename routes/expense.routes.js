const express = require('express');
const router = express.Router();

const ktExpenseRoutes = require('./expenseRoutes');
const finExpenseController = require('../controllers/expense.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validateRequest');
const access = require('../middleware/companyAccess');
const {
  READ_ROLES,
  ENTRY_ROLES,
  WRITE_ROLES,
  requireFinanceCompanyAccess,
  requireFinanceRole
} = require('../middleware/financeAccess');
const { expense, query, validateQuery } = require('../validators/expense.validators');

// 1. KT HRMS Expense Endpoints (/create, /all, /update/:id, /income/..., /transactions/..., /reports/...)
router.use('/', ktExpenseRoutes);

// 2. Finance Expense Endpoints (/, /)
router.post('/', authenticate, validate(expense), access, requireFinanceCompanyAccess, requireFinanceRole(ENTRY_ROLES), finExpenseController.create);
router.get('/', authenticate, validateQuery(query), access, requireFinanceCompanyAccess, requireFinanceRole(READ_ROLES), finExpenseController.list);

module.exports = router;
