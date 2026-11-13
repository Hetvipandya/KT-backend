const Expense = require("../models/Expense");
const Income = require("../models/Income");
const Transaction = require("../models/Transaction");
const FinancialYear = require("../models/FinancialYear");
const BankAccount = require("../models/BankAccount");
const journalEntryService = require("../services/journalEntry.service");
const { ensureIncomeLedger } = require("../services/autoCoaMapping.service");

const incomeError = (message, statusCode = 400, errorCode) =>
  Object.assign(new Error(message), { statusCode, errorCode });

const resolveIncomePostingContext = async ({
  companyId,
  branchId,
  financialYearId,
  receivedDate,
  paymentMode,
  bankAccountId,
}) => {
  const date = new Date(receivedDate);
  if (!Number.isFinite(date.getTime())) {
    throw incomeError("Received date must be valid.", 400, "INVALID_INCOME_DATE");
  }

  const scope = { companyId, ...(branchId ? { branchId } : {}) };
  const financialYear = financialYearId
    ? await FinancialYear.findOne({ _id: financialYearId, ...scope })
    : await FinancialYear.findOne({
      ...scope,
      startDate: { $lte: date },
      endDate: { $gte: date },
    });
  if (!financialYear) {
    throw incomeError("No financial year covers this income date.", 400, "FINANCIAL_YEAR_NOT_FOUND");
  }
  if (financialYear.isLocked) {
    throw incomeError("Cannot post income to a locked financial year.", 409, "FINANCIAL_YEAR_LOCKED");
  }
  if (date < financialYear.startDate || date > financialYear.endDate) {
    throw incomeError("Received date must fall within the selected financial year.", 400, "INCOME_DATE_OUTSIDE_FINANCIAL_YEAR");
  }

  const accountTypes = {
    cash: ["Cash", "Wallet"],
    bank: ["Savings", "Current"],
    online: ["UPI", "Savings", "Current"],
  }[paymentMode];
  if (!accountTypes) {
    throw incomeError("Select a valid income payment mode.", 400, "INVALID_INCOME_PAYMENT_MODE");
  }
  const accountScope = { companyId, isActive: true };
  let bankAccount;
  if (bankAccountId) {
    bankAccount = await BankAccount.findOne({
      _id: bankAccountId,
      ...accountScope,
      accountType: { $in: accountTypes },
      ...(branchId ? { $or: [{ branchId }, { branchId: null }] } : {}),
    });
    if (!bankAccount) {
      throw incomeError("Selected payment account is not an active compatible account for this company.", 400, "INVALID_PAYMENT_ACCOUNT");
    }
  }

  if (!bankAccount) {
    for (const branchFilter of branchId ? [{ branchId }, { branchId: null }] : [{}]) {
      bankAccount = await BankAccount.findOne({
        ...accountScope,
        ...branchFilter,
        accountType: { $in: accountTypes },
      });
      if (bankAccount) break;
    }
  }
  if (!bankAccount) {
    throw incomeError(
      `Create an active ${paymentMode === "cash" ? "cash" : "bank"} account before recording income.`,
      400,
      "PAYMENT_ACCOUNT_REQUIRED"
    );
  }

  return { financialYear, bankAccount, receivedDate: date };
};

const postIncomeJournalEntry = async (income, financialYear, bankAccount, userId) =>
  journalEntryService.createJournalEntry({
    companyId: income.companyId,
    branchId: income.branchId || null,
    financialYearId: financialYear._id,
    entryDate: new Date(income.receivedDate),
    reference: income.reference || `INC-${income._id.toString().slice(-6)}`,
    narration: `Income: ${income.incomeType} - ${income.title}`,
    lines: [
      {
        accountId: bankAccount.coaAccountId,
        debit: income.amount,
        credit: 0,
        remarks: `Income received (${income.paymentMode})`,
      },
      {
        accountId: income.coaAccountId,
        debit: 0,
        credit: income.amount,
        remarks: income.title,
      },
    ],
  }, userId);

/**
 * Create Expense
 */
exports.createExpense = async (req, res) => {
  try {
    const expense = await Expense.create({
      ...req.body,
      companyId: req.company._id,
      branchId: req.branchId || null,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    res.status(201).json({
      success: true, 
      message: "Expense created successfully",
      data: expense,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get All Expenses
 */
exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({
      companyId: req.company._id,
      ...(req.branchId ? { branchId: req.branchId } : {})
    })
      .populate("employeeId", "name email")
      .populate("projectId", "projectName")
      .sort({ createdAt: -1 });
 
    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Single Expense
 */
exports.getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      companyId: req.company._id
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update Expense
 */
exports.updateExpense = async (req, res) => {
  try {
    const existing = await Expense.findOne({
      _id: req.params.id,
      companyId: req.company._id
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }
    if (existing.journalEntryId) {
      return res.status(409).json({
        success: false,
        message: "Posted expenses cannot be edited; use a reversal instead"
      });
    }

    const updates = { ...req.body };
    delete updates.companyId;
    delete updates.branchId;
    delete updates.journalEntryId;
    updates.updatedBy = req.user._id;
    const expense = await Expense.findOneAndUpdate(
      { _id: existing._id, companyId: req.company._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateIncome = async (req, res, next) => {
  try {
    const companyId = req.company?._id;
    const income = await Income.findOne({ _id: req.params.id, companyId });

    if (!income) {
      return res.status(404).json({
        success: false,
        message: "Income not found",
      });
    }

    const previous = income.toObject();
    const updates = {};
    ["incomeType", "title", "amount", "receivedDate", "paymentMode", "description", "financialYearId", "bankAccountId"].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    if (updates.title || updates.incomeType) {
      const title = updates.title || income.title;
      const incomeType = updates.incomeType || income.incomeType;
      const incomeAccount = await ensureIncomeLedger(
        companyId,
        title,
        `income:legacy:${incomeType}:${String(title).trim().replace(/\s+/g, " ").toLowerCase()}`
      );
      updates.coaAccountId = incomeAccount._id;
    }

    Object.assign(income, updates, {
      branchId: req.branchId || income.branchId || null,
      updatedBy: req.user?._id || null,
    });
    if (!Number.isFinite(Number(income.amount)) || Number(income.amount) <= 0) {
      throw incomeError("Income amount must be greater than zero.", 400, "INVALID_INCOME_AMOUNT");
    }

    const postingContext = await resolveIncomePostingContext({
      companyId,
      branchId: income.branchId,
      financialYearId: income.financialYearId,
      receivedDate: income.receivedDate,
      paymentMode: income.paymentMode,
      bankAccountId: income.bankAccountId,
    });
    const oldJournalEntryId = income.journalEntryId;
    const replacementJournal = await postIncomeJournalEntry(
      income,
      postingContext.financialYear,
      postingContext.bankAccount,
      req.user?._id
    );
    try {
      income.financialYearId = postingContext.financialYear._id;
      income.bankAccountId = postingContext.bankAccount._id;
      income.journalEntryId = replacementJournal._id;
      await income.save();
      if (oldJournalEntryId) {
        await journalEntryService.reverseJournalEntry(oldJournalEntryId, req.user?._id);
      }
    } catch (error) {
      try {
        await journalEntryService.reverseJournalEntry(replacementJournal._id, req.user?._id);
        Object.assign(income, previous);
        await income.save();
      } catch (rollbackError) {
        console.error("Failed to roll back income update journals:", rollbackError.message);
        error.rollbackError = rollbackError.message;
      }
      throw error;
    }

    res.status(200).json({
      success: true,
      message: "Income updated successfully",
      data: income,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Expense
 */
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      companyId: req.company._id
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (expense.journalEntryId) {
      return res.status(409).json({
        success: false,
        message: "Posted expenses cannot be deleted; use a reversal instead"
      });
    }

    await expense.deleteOne();

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Approve Expense
 */
// exports.approveExpense = async (req, res) => {
//   try {
//     const { approvedBy } = req.body;

//     const expense = await Expense.findById(req.params.id);

//     if (!expense) {
//       return res.status(404).json({
//         success: false,
//         message: "Expense not found",
//       });
//     }

//     expense.approvalStatus = "approved";
//     expense.approvedBy = approvedBy;
//     expense.approvedAt = new Date();

//     await expense.save();

//     await Transaction.create({
//       transactionType: "expense",
//       referenceId: expense._id,
//       amount: expense.amount,
//       paymentMode: expense.paymentMode,
//     });

//     res.status(200).json({
//       success: true,
//       message: "Expense approved successfully",
//       data: expense,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// /**
//  * Reject Expense
//  */
// exports.rejectExpense = async (req, res) => {
//   try {
//     const { approvedBy, rejectionReason } = req.body;

//     const expense = await Expense.findById(req.params.id);

//     if (!expense) {
//       return res.status(404).json({
//         success: false,
//         message: "Expense not found",
//       });
//     }

//     expense.approvalStatus = "rejected";
//     expense.approvedBy = approvedBy;
//     expense.approvedAt = new Date();
//     expense.rejectionReason = rejectionReason;

//     await expense.save();

//     res.status(200).json({
//       success: true,
//       message: "Expense rejected successfully",
//       data: expense,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

/**
 * Create Income
 */
exports.createIncome = async (req, res, next) => {
  let income;
  let journalEntry;
  try {
    const companyId = req.company?._id || req.body.companyId;
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required for income COA mapping.",
      });
    }

    if (!Number.isFinite(Number(req.body.amount)) || Number(req.body.amount) <= 0) {
      throw incomeError("Income amount must be greater than zero.", 400, "INVALID_INCOME_AMOUNT");
    }

    const incomeAccount = await ensureIncomeLedger(
      companyId,
      req.body.title,
      `income:legacy:${req.body.incomeType}:${String(req.body.title).trim().replace(/\s+/g, " ").toLowerCase()}`
    );
    const postingContext = await resolveIncomePostingContext({
      companyId,
      branchId: req.branchId || null,
      financialYearId: req.body.financialYearId,
      receivedDate: req.body.receivedDate,
      paymentMode: req.body.paymentMode,
      bankAccountId: req.body.bankAccountId,
    });
    income = await Income.create({
      ...req.body,
      companyId,
      branchId: req.branchId || null,
      financialYearId: postingContext.financialYear._id,
      bankAccountId: postingContext.bankAccount._id,
      coaAccountId: incomeAccount._id,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    journalEntry = await postIncomeJournalEntry(
      income,
      postingContext.financialYear,
      postingContext.bankAccount,
      req.user?._id
    );
    income.journalEntryId = journalEntry._id;
    await income.save();

    await Transaction.create({
      transactionType: "income",
      referenceId: income._id,
      amount: income.amount,
      paymentMode: income.paymentMode,
    });

    res.status(201).json({
      success: true,
      message: "Income created successfully",
      data: {
        ...income.toObject(),
        coaAccountName: incomeAccount.name,
        coaAccountCode: incomeAccount.code,
        journalEntryId: journalEntry._id,
      },
    });
  } catch (error) {
    if (income) {
      try {
        if (journalEntry) {
          await journalEntryService.reverseJournalEntry(journalEntry._id, req.user?._id);
        }
        await Income.deleteOne({ _id: income._id });
      } catch (rollbackError) {
        console.error("Failed to roll back income creation:", rollbackError.message);
        error.rollbackError = rollbackError.message;
      }
    }
    next(error);
  }
};

/**
 * Get All Income
 */
exports.getAllIncome = async (req, res, next) => {
  try {
    const incomes = await Income.find({
      companyId: req.company._id,
      ...(req.branchId ? { branchId: req.branchId } : {}),
    })
      .populate("coaAccountId", "name code")
      .sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: incomes.length,
      data: incomes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Transactions
 */
exports.getTransactions = async (req, res) => {
  try {
    const scope = {
      companyId: req.company._id,
      ...(req.branchId ? { branchId: req.branchId } : {})
    };
    const [expenseIds, incomeIds] = await Promise.all([
      Expense.find(scope).distinct("_id"),
      Income.find(scope).distinct("_id")
    ]);
    const transactions = await Transaction.find({
      referenceId: { $in: [...expenseIds, ...incomeIds] }
    }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Profit & Loss Report
 */
exports.getProfitLoss = async (req, res) => {
  try {
    const scope = {
      companyId: req.company._id,
      ...(req.branchId ? { branchId: req.branchId } : {})
    };
    const income = await Income.aggregate([
      { $match: scope },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const expense = await Expense.aggregate([
      {
        $match: {
          ...scope,
          approvalStatus: "approved",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalIncome = income[0]?.total || 0;
    const totalExpense = expense[0]?.total || 0;

    res.status(200).json({
      success: true,
      totalIncome,
      totalExpense,
      profit: totalIncome - totalExpense,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Balance Sheet
 */
exports.getBalanceSheet = async (req, res) => {
  try {
    const scope = {
      companyId: req.company._id,
      ...(req.branchId ? { branchId: req.branchId } : {})
    };
    const income = await Income.aggregate([
      { $match: scope },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const expense = await Expense.aggregate([
      {
        $match: {
          ...scope,
          approvalStatus: "approved",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const assets = income[0]?.total || 0;
    const liabilities = expense[0]?.total || 0;

    res.status(200).json({
      success: true,
      assets,
      liabilities,
      netWorth: assets - liabilities,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};