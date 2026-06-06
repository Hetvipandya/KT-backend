const Expense = require("../models/Expense");

/**
 * Create Expense
 */
exports.createExpense =
  async (req, res) => {
    try {
      const expense =
        await Expense.create(
          req.body
        );

      res.status(201).json({
        success: true,
        message:
          "Expense created successfully",
        data: expense,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/**
 * Get All Expenses
 */
exports.getExpenses =
  async (req, res) => {
    try {
      const expenses =
        await Expense.find()
          .populate(
            "employeeId",
            "name email"
          )
          .populate(
            "projectId",
            "projectName"
          )
          .populate(
            "approvedBy",
            "name"
          )
          .sort({
            createdAt: -1,
          });

      res.status(200).json({
        success: true,
        count:
          expenses.length,
        data: expenses,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/**
 * Get Single Expense
 */
exports.getExpenseById =
  async (req, res) => {
    try {
      const expense =
        await Expense.findById(
          req.params.id
        );

      if (!expense) {
        return res.status(404).json({
          success: false,
          message:
            "Expense not found",
        });
      }

      res.status(200).json({
        success: true,
        data: expense,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/**
 * Update Expense
 */
exports.updateExpense =
  async (req, res) => {
    try {
      const expense =
        await Expense.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true }
        );

      res.status(200).json({
        success: true,
        message:
          "Expense updated successfully",
        data: expense,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/**
 * Delete Expense
 */
exports.deleteExpense =
  async (req, res) => {
    try {
      const expense =
        await Expense.findById(
          req.params.id
        );

      if (!expense) {
        return res.status(404).json({
          success: false,
          message:
            "Expense not found",
        });
      }

      await expense.deleteOne();

      res.status(200).json({
        success: true,
        message:
          "Expense deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/**
 * Approve Expense
 */
exports.approveExpense =
  async (req, res) => {
    try {
      const {
        approvedBy,
      } = req.body;

      const expense =
        await Expense.findById(
          req.params.id
        );

      if (!expense) {
        return res.status(404).json({
          success: false,
          message:
            "Expense not found",
        });
      }

      expense.approvalStatus =
        "approved";
      expense.approvedBy =
        approvedBy;
      expense.approvedAt =
        new Date();

      await expense.save();

      res.status(200).json({
        success: true,
        message:
          "Expense approved successfully",
        data: expense,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/**
 * Reject Expense
 */
exports.rejectExpense =
  async (req, res) => {
    try {
      const {
        approvedBy,
        rejectionReason,
      } = req.body;

      const expense =
        await Expense.findById(
          req.params.id
        );

      if (!expense) {
        return res.status(404).json({
          success: false,
          message:
            "Expense not found",
        });
      }

      expense.approvalStatus =
        "rejected";
      expense.approvedBy =
        approvedBy;
      expense.approvedAt =
        new Date();
      expense.rejectionReason =
        rejectionReason;

      await expense.save();

      res.status(200).json({
        success: true,
        message:
          "Expense rejected successfully",
        data: expense,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };