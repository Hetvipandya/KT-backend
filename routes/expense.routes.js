const express = require('express');
const router = express.Router();

const ktExpenseRoutes = require('./expenseRoutes');
const finExpenseController = require('../controllers/expense.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validateRequest');
const access = require('../middleware/companyAccess');
const { expense, query, validateQuery } = require('../validators/expense.validators');

// 1. KT HRMS Expense Endpoints (/create, /all, /update/:id, /income/..., /transactions/..., /reports/...)
router.use('/', ktExpenseRoutes);

// 2. Finance Expense Endpoints (/, /)
router.post('/', authenticate, validate(expense), access, finExpenseController.create);
router.get('/', authenticate, validateQuery(query), access, finExpenseController.list);

module.exports = router;
