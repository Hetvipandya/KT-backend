const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authenticate");
const checkCompanyAccess = require("../middleware/companyAccess");

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
  createExpense
);

router.get(
  "/all",
  getExpenses
);

router.get(
  "/:id",
  getExpenseById
);

router.put(
  "/update/:id",
  updateExpense
);

router.put(
  "/update/income/:id",
  authenticate,
  checkCompanyAccess,
  updateIncome
);

router.delete(
  "/delete/:id",
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
  createIncome
);

router.get(
  "/income/all",
  authenticate,
  checkCompanyAccess,
  getAllIncome
);


// Transaction Routes


router.get(
  "/transactions/all",
  getTransactions
);


// Reports Routes


router.get(
  "/reports/profit-loss",
  getProfitLoss
);

router.get(
  "/reports/balance-sheet",
  getBalanceSheet
);

module.exports = router;