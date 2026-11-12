const Expense = require("../models/Expense");
const Income = require("../models/Income");
const Transaction = require("../models/Transaction");
const { ensureIncomeLedger } = require("../services/autoCoaMapping.service");

/**
 * Create Expense
 */
exports.createExpense = async (req, res) => {
  try {
    const expense = await Expense.create(req.body);

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
    const expenses = await Expense.find()
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
    const expense = await Expense.findById(req.params.id);

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
    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
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

    const updates = {};
    ["incomeType", "title", "amount", "receivedDate", "paymentMode", "description"].forEach((field) => {
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

    Object.assign(income, updates, { branchId: req.branchId || null });
    await income.save();

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
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
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
  try {
    const companyId = req.company?._id || req.body.companyId;
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required for income COA mapping.",
      });
    }

    const incomeAccount = await ensureIncomeLedger(
      companyId,
      req.body.title,
      `income:legacy:${req.body.incomeType}:${String(req.body.title).trim().replace(/\s+/g, " ").toLowerCase()}`
    );
    const income = await Income.create({
      ...req.body,
      companyId,
      branchId: req.branchId || null,
      coaAccountId: incomeAccount._id,
      createdBy: req.user?._id || null,
    });

    await Transaction.create({
      transactionType: "income",
      referenceId: income._id,
      amount: income.amount,
      paymentMode: income.paymentMode,
    });

    res.status(201).json({
      success: true,
      message: "Income created successfully",
      data: { ...income.toObject(), coaAccountName: incomeAccount.name, coaAccountCode: incomeAccount.code },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Income
 */
exports.getAllIncome = async (req, res, next) => {
  try {
    const incomes = await Income.find({ companyId: req.company._id })
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
    const transactions = await Transaction.find().sort({
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
    const income = await Income.aggregate([
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
    const income = await Income.aggregate([
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