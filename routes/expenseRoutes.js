const express = require("express");
const router = express.Router();

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
  createIncome
);

router.get(
  "/income/all",
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