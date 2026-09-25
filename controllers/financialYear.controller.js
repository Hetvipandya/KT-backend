const FinancialYear = require('../models/FinancialYear');
const Company = require('../models/Company');
const Branch = require('../models/Branch');
const User = require('../models/User');

/** 
 * POST /api/financial-year
 * Create a new Financial Year for a company
 */
const createFinancialYear = async (req, res, next) => {
  const session = await FinancialYear.startSession();
  let transactionStarted = false;

  try {
    try {
      await session.startTransaction();
      await FinancialYear.findOne().session(session);
      transactionStarted = true;
    } catch (startErr) {
      if (!startErr.message.includes('Transaction numbers are only allowed on a replica set member or mongos')) {
        throw startErr;
      }
      transactionStarted = false;
      try {
        await session.abortTransaction();
      } catch (ignore) {
        // Best-effort cleanup when transaction support is unavailable.
      }
    }

    const sessionOpts = transactionStarted ? { session } : {};

    if (!req.user.companyCreated) {
      if (transactionStarted) await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Complete company setup first.',
        nextStep: 'CREATE_COMPANY'
      });
    }

    if (!req.user.branchCreated) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Complete branch setup first.',
        nextStep: 'CREATE_BRANCH'
      });
    }

    const { companyId, branchId, startDate, endDate, yearLabel, isLocked, status } = req.body;
 
    // A branch cannot be associated with another company's financial year.
    const branchQuery = Branch.findOne({ _id: branchId, companyId });
    if (transactionStarted) branchQuery.session(session);
    const branch = await branchQuery;
    if (!branch) {
      if (transactionStarted) await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Branch does not belong to the specified company',
        errorCode: 'INVALID_BRANCH_COMPANY'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date',
        errorCode: 'INVALID_DATE_RANGE'
      });
    }

    // Business Rule Check: Check overlap within the same branch.
    const overlap = transactionStarted
      ? await FinancialYear.findOne({
          companyId,
          branchId,
          startDate: { $lte: end },
          endDate: { $gte: start }
        }).session(session)
      : await FinancialYear.findOne({
          companyId,
          branchId,
          startDate: { $lte: end },
          endDate: { $gte: start }
        });

    if (overlap) {
      if (transactionStarted) await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'This date range overlaps with an existing Financial Year for this branch.',
        errorCode: 'FINANCIAL_YEAR_OVERLAP'
      });
    }

    const [fy] = await FinancialYear.create([
      {
        companyId,
        branchId,
        startDate: start,
        endDate: end,
        yearLabel,
        ...(isLocked !== undefined ? { isLocked } : {}),
        ...(status !== undefined ? { status } : {})
      }
    ], sessionOpts);

    const updateFields = {
      financialYearCreated: true,
      financialYearId: fy._id
    };

    await User.findByIdAndUpdate(req.user._id, updateFields, { new: true, ...sessionOpts });

    const FinanceUser = require('../models/FinanceUser');
    await FinanceUser.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          companyId,
          branchId,
          financialYearId: fy._id,
          companyCreated: true,
          branchCreated: true,
          financialYearCreated: true,
          role: req.user.role || 'admin'
        }
      },
      { upsert: true, new: true }
    );

    if (transactionStarted) {
      await session.commitTransaction();
    }

    return res.status(201).json({
      success: true,
      message: 'Financial Year created successfully',
      data: {
        ...fy.toObject(),
        nextStep: 'DASHBOARD'
      }
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await session.abortTransaction();
      } catch (ignore) {
        // Ignore abort errors when transaction support is unavailable.
      }
    }
    next(error);
  } finally {
    await session.endSession();
  }
};

/**
 * GET /api/financial-year?branchId=
 * List all financial years for one branch. The company is resolved from the branch.
 */
const listFinancialYears = async (req, res, next) => {
  try {
    const { branchId } = req.query;
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required',
        errorCode: 'BRANCH_ID_REQUIRED'
      });
    }

    // checkCompanyAccess has already verified both the branch and the user's
    // access to its company.
    const filter = { companyId: req.branch.companyId, branchId };
    const financialYears = await FinancialYear.find(filter).sort({ startDate: 1 });

    return res.status(200).json({
      success: true,
      data: financialYears
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/financial-year/:id/lock
 * Lock a financial year to prevent transaction postings
 */
const lockFinancialYear = async (req, res, next) => {
  try {
    const fy = req.financialYear; // loaded by checkCompanyAccess middleware

    if (fy.isLocked) {
      return res.status(400).json({
        success: false,
        message: 'This financial year is already locked',
        errorCode: 'ALREADY_LOCKED'
      });
    }

    fy.isLocked = true;
    fy.lockedAt = new Date();
    fy.lockedBy = req.user._id;

    await fy.save();

    return res.status(200).json({
      success: true,
      data: fy
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/financial-year/:id
 * Delete a financial year if it has no associated transactions
 */
const deleteFinancialYear = async (req, res, next) => {
  try {
    const fy = req.financialYear; // loaded by checkCompanyAccess middleware

    // Check for associated transactions
    let hasTransactions = false;
    try {
      const mongoose = require('mongoose');
      if (mongoose.models.Transaction) {
        const Transaction = mongoose.model('Transaction');
        const count = await Transaction.countDocuments({ financialYearId: fy._id });
        hasTransactions = count > 0;
      }
    } catch (e) {}

    if (hasTransactions) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete Financial Year because it has associated transactions',
        errorCode: 'FY_HAS_TRANSACTIONS'
      });
    }

    await FinancialYear.findByIdAndDelete(fy._id);

    // Find remaining active Financial Year for this branch if available
    const remainingFy = await FinancialYear.findOne({ branchId: fy.branchId }).sort({ startDate: -1 });

    if (remainingFy) {
      await User.updateMany(
        { financialYearId: fy._id },
        {
          $set: {
            financialYearId: remainingFy._id,
            financialYearCreated: true
          }
        }
      );
    } else {
      await User.updateMany(
        { financialYearId: fy._id },
        {
          $set: {
            financialYearId: null,
            financialYearCreated: false
          }
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Financial Year deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFinancialYear,
  listFinancialYears,
  lockFinancialYear,
  deleteFinancialYear
};
