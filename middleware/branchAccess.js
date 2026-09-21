const mongoose = require('mongoose');
const Branch = require('../models/Branch');

/**
 * Middleware to resolve and enforce branch-level data access control.
 * Sets `req.branchId` on the request object.
 */
const checkBranchAccess = async (req, res, next) => {
  try {
    const activeCompanyId = req.company?._id?.toString() || req.user?.companyId?.toString();
    const activeAccess = (req.user?.companyAccess || []).find(
      (a) => a.isActive !== false && (activeCompanyId ? a.companyId.toString() === activeCompanyId : true)
    );
    const userBranchId = activeAccess?.branchId || req.user?.branchId || null;

    let targetBranchId = null;

    // Prioritize already resolved target branch (e.g. /api/branch/:id loaded by companyAccess)
    if (req.branch && req.branch._id) {
      targetBranchId = req.branch._id.toString();
    } else if (req.query && req.query.branchId) {
      targetBranchId = req.query.branchId;
    } else if (req.headers && req.headers['x-branch-id']) {
      targetBranchId = req.headers['x-branch-id'];
    } else if (req.body && req.body.branchId) {
      targetBranchId = req.body.branchId;
    } else if (userBranchId) {
      targetBranchId = userBranchId.toString();
    }

    // Treat 'all' string as explicit request for all branches (for admins)
    if (targetBranchId === 'all') {
      targetBranchId = null;
    }

    // Validate ObjectId format if a target branch ID was explicitly provided
    if (targetBranchId && !mongoose.Types.ObjectId.isValid(targetBranchId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid branch ID format',
        errorCode: 'INVALID_BRANCH_ID'
      });
    }

    const activeRole = String(activeAccess?.role || req.user?.role || '').trim().toLowerCase();
    const isCompanyAdminOrOwner = req.user && (
      activeRole === 'superadmin' ||
      activeRole === 'admin' ||
      (req.company && req.company.createdBy && req.company.createdBy.toString() === req.user._id.toString()) ||
      req.user.companyCreated === true
    );

    // If user is restricted to a specific branch
    if (userBranchId && !isCompanyAdminOrOwner) {
      const assignedBranchId = userBranchId.toString();

      // If user requested a different branch than assigned
      if (targetBranchId && targetBranchId !== assignedBranchId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have access to this branch data',
          errorCode: 'BRANCH_ACCESS_DENIED'
        });
      }

      targetBranchId = assignedBranchId;
    }

    // Verify branch belongs to the user's company if branchId is supplied
    if (targetBranchId && req.company) {
      const branch = await Branch.findOne({ _id: targetBranchId, companyId: req.company._id });
      if (!branch) {
        return res.status(400).json({
          success: false,
          message: 'Branch not found or does not belong to your company',
          errorCode: 'INVALID_BRANCH'
        });
      }
      req.branch = branch;
    }

    req.branchId = targetBranchId ? targetBranchId.toString() : null;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to build a MongoDB query filter object containing companyId and branchId (if set)
 */
const getBranchFilter = (req) => {
  const filter = {};
  if (req.company && req.company._id) {
    filter.companyId = req.company._id;
  } else if (req.user && req.user.companyId) {
    filter.companyId = req.user.companyId;
  }

  if (req.branchId) {
    filter.branchId = req.branchId;
  }

  return filter;
};

module.exports = {
  checkBranchAccess,
  getBranchFilter
};
