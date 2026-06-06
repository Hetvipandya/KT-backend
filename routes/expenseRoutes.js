const express = require("express");

const router =
  express.Router();

const {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
} = require(
  "../controllers/expenseController"
);

// CRUD APIs
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

router.delete(
  "/delete/:id",
  deleteExpense
);

// Approval APIs
router.put(
  "/approve/:id",
  approveExpense
);

router.put(
  "/reject/:id",
  rejectExpense
);

module.exports =
  router;