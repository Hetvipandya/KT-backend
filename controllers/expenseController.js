const Expense = require("../models/Expense");
const Income = require("../models/Income");
const Transaction = require("../models/Transaction");

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

exports.updateIncome = async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);

    if (!income) {
      return res.status(404).json({
        success: false,
        message: "Income not found",
      });
    }

    const updatedIncome = await Income.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Income updated successfully",
      data: updatedIncome,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
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
exports.createIncome = async (req, res) => {
  try {
    const income = await Income.create(req.body);

    await Transaction.create({
      transactionType: "income",
      referenceId: income._id,
      amount: income.amount,
      paymentMode: income.paymentMode,
    });

    res.status(201).json({
      success: true,
      message: "Income created successfully",
      data: income,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get All Income
 */
exports.getAllIncome = async (req, res) => {
  try {
    const incomes = await Income.find().sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: incomes.length,
      data: incomes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
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