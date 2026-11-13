const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authenticate");
const checkCompanyAccess = require("../middleware/companyAccess");
const {
  READ_ROLES,
  ENTRY_ROLES,
  WRITE_ROLES,
  requireFinanceCompanyAccess,
  requireFinanceRole
} = require("../middleware/financeAccess");

const {
  // Expense APIs
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,

  // Income APIs
  createIncome,
  getAllIncome,
  updateIncome,

  // Transaction APIs
  getTransactions,

  // Report APIs
  getProfitLoss,
  getBalanceSheet,
} = require(
  "../controllers/expenseController"
);


// Expense Routes


router.post(
  "/create", 
  authenticate,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(ENTRY_ROLES),
  createExpense
);

router.get(
  "/all",
  authenticate,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(READ_ROLES),
  getExpenses
);

router.get(
  "/:id",
  authenticate,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(READ_ROLES),
  getExpenseById
);

router.put(
  "/update/:id",
  authenticate,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(ENTRY_ROLES),
  updateExpense
);

router.put(
  "/update/income/:id",
  authenticate,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(WRITE_ROLES),
  updateIncome
);

router.delete(
  "/delete/:id",
  authenticate,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(WRITE_ROLES),
  deleteExpense
);

// router.put(
//   "/approve/:id",
//   approveExpense
// );

// router.put(
//   "/reject/:id",
//   rejectExpense
// );


// Income Routes


router.post(
  "/income/create",
  authenticate,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(WRITE_ROLES),
  createIncome
);

router.get(
  "/income/all",
  authenticate,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(READ_ROLES),
  getAllIncome
);


// Transaction Routes


router.get(
  "/transactions/all",
  authenticate,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(READ_ROLES),
  getTransactions
);


// Reports Routes


router.get(
  "/reports/profit-loss",
  authenticate,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(READ_ROLES),
  getProfitLoss
);

router.get(
  "/reports/balance-sheet",
  authenticate,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(READ_ROLES),
  getBalanceSheet
);

module.exports = router;