const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Company = require('../models/Company');
const User = require('../models/User');
const { determineNextStep } = require('../utils/onboarding');

const { invalidateUserCache } = require('../middleware/authenticate');

/**
 * POST /api/branch
 * Create a new branch for a company
 */
const createBranch = async (req, res, next) => {
  try {
    // Resolve user's company (checking middleware attachment, user document, active access, or DB lookup)
    const userCompany = req.company || await Company.findOne({ createdBy: req.user._id });
    const hasCompany = req.user.companyCreated || !!req.user.companyId || !!userCompany || (req.user.companyAccess && req.user.companyAccess.some(a => a.isActive));

    if (!hasCompany) {
      return res.status(403).json({
        success: false,
        message: 'Complete company setup first.',
        nextStep: 'CREATE_COMPANY'
      });
    }

    const { companyId: bodyCompanyId, branchName, branchCode, address, city, state, pincode, country, phone, email, manager, isHeadOffice, status } = req.body;
    let companyId = bodyCompanyId || req.query.companyId || (req.company && req.company._id) || req.user.companyId;

    if (!companyId && userCompany) {
      companyId = userCompany._id;
    }
    if (!companyId && req.user.companyAccess && req.user.companyAccess.length > 0) {
      const activeAccess = req.user.companyAccess.find(a => a.isActive);
      if (activeAccess) companyId = activeAccess.companyId;
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required to create a branch',
        errorCode: 'COMPANY_ID_REQUIRED'
      });
    }

    // Count existing branches for the company
    const count = await Branch.countDocuments({ companyId });
    
    let shouldBeHeadOffice = isHeadOffice || false;
    
    // First branch must be the head office
    if (count === 0) {
      shouldBeHeadOffice = true;
    }

    // If this branch is to be the Head Office, unset any existing Head Office for this company
    if (shouldBeHeadOffice) {
      await Branch.updateMany({ companyId }, { $set: { isHeadOffice: false } });
    }

    const branch = await Branch.create({
      companyId,
      branchName,
      branchCode,
      address,
      city,
      state,
      pincode,
      country: country || 'India',
      phone,
      email,
      manager,
      isHeadOffice: shouldBeHeadOffice,
      status
    });

    const updateFields = {
      companyId,
      companyCreated: true,
      branchCreated: true,
      branchId: branch._id
    };

    await User.findByIdAndUpdate(req.user._id, updateFields);
    invalidateUserCache(req.user._id);

    return res.status(201).json({
      success: true,
      data: {
        ...branch.toObject(),
        nextStep: 'CREATE_FINANCIAL_YEAR'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/branch?companyId=
 * List all branches of a company
 */
const listBranches = async (req, res, next) => {
  try {
    let companyId = req.query.companyId || req.body?.companyId || (req.company && req.company._id) || req.user?.companyId;

    if (!companyId && req.user?.companyAccess?.length > 0) {
      const activeAccess = req.user.companyAccess.find(a => a.isActive);
      if (activeAccess) companyId = activeAccess.companyId;
    }

    if (!companyId && req.user) {
      const createdCompany = await Company.findOne({ createdBy: req.user._id });
      if (createdCompany) companyId = createdCompany._id;
    }

    const branches = await Branch.find({ companyId });

    return res.status(200).json({
      success: true,
      data: branches
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/branch/:id
 * Update branch details
 */
const updateBranch = async (req, res, next) => {
  try {
    const updates = req.body;
    const branch = req.branch; // loaded by checkCompanyAccess middleware

    // Business Rule Check: Cannot manually unset Head Office directly
    if (updates.isHeadOffice === false && branch.isHeadOffice) {
      const otherBranchesCount = await Branch.countDocuments({ companyId: branch.companyId, _id: { $ne: branch._id } });
      if (otherBranchesCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'A company must have at least one Head Office. Set another branch as Head Office to transfer the status.',
          errorCode: 'MINIMUM_ONE_HEAD_OFFICE'
        });
      } else {
        // Only branch cannot unset head office
        updates.isHeadOffice = true;
      }
    }

    // If setting this branch as Head Office, unset all other branches for the company
    if (updates.isHeadOffice === true) {
      await Branch.updateMany({ companyId: branch.companyId }, { $set: { isHeadOffice: false } });
    }

    // Update other fields
    const allowedFields = ['branchName', 'branchCode', 'address', 'city', 'state', 'pincode', 'country', 'phone', 'email', 'manager', 'isHeadOffice', 'status'];
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        branch[field] = updates[field];
      }
    });

    await branch.save();

    return res.status(200).json({
      success: true,
      data: branch
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/branch/:id
 * Delete a branch if it has no associated transactions
 */
const deleteBranch = async (req, res, next) => {
  try {
    const branch = req.branch; // loaded by checkCompanyAccess middleware

    // Business Rule Check: Cannot delete the Head Office
    if (branch.isHeadOffice) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the Head Office branch. Transfer Head Office status to another branch first.',
        errorCode: 'CANNOT_DELETE_HEAD_OFFICE'
      });
    }

    // Check for associated transactions using a dynamic lookup
    let hasTransactions = false;
    try {
      if (mongoose.models.Transaction) {
        const Transaction = mongoose.model('Transaction');
        const count = await Transaction.countDocuments({ branchId: branch._id });
        hasTransactions = count > 0;
      }
    } catch (e) {
      // Dynamic lookup fallback if Transaction schema isn't registered yet
    }

    if (hasTransactions) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete branch because it has associated transactions',
        errorCode: 'BRANCH_HAS_TRANSACTIONS'
      });
    }

    await Branch.findByIdAndDelete(branch._id);

    // Clean up Financial Years linked to this deleted branch
    const FinancialYear = require('../models/FinancialYear');
    await FinancialYear.deleteMany({ branchId: branch._id });

    // Check for remaining active branches in the company
    const remainingBranch = await Branch.findOne({ companyId: branch.companyId }).sort({ isHeadOffice: -1 });

    if (remainingBranch) {
      const remainingFy = await FinancialYear.findOne({ branchId: remainingBranch._id }).sort({ startDate: -1 });
      await User.updateMany(
        { companyId: branch.companyId, branchId: branch._id },
        {
          $set: {
            branchId: remainingBranch._id,
            branchCreated: true,
            financialYearId: remainingFy ? remainingFy._id : null,
            financialYearCreated: !!remainingFy
          }
        }
      );
    } else {
      await User.updateMany(
        { companyId: branch.companyId },
        {
          $set: {
            branchId: null,
            branchCreated: false,
            financialYearId: null,
            financialYearCreated: false
          }
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Branch removed'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBranch,
  listBranches,
  updateBranch,
  deleteBranch
};
