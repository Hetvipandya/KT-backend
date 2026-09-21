const User = require('../models/User');
const Branch = require('../models/Branch');
const FinancialYear = require('../models/FinancialYear');
const pino = require('pino');
const env = require('../config/env');

const logger = pino({
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
});

/**
 * Reconcile a single user's branchId and financialYearId.
 * Authoritatively checks if branches/FYs exist in DB for the user's company/branch.
 * If zero branches exist, resets branchId -> null and branchCreated -> false.
 * If zero FYs exist, resets financialYearId -> null and financialYearCreated -> false.
 * @param {Object} user 
 * @returns {Promise<Object>} Updated user object
 */
const reconcileUserOrphanedReferences = async (user) => {
  if (!user || !user._id) return user;

  let needsUpdate = false;
  let updateFields = {};

  const companyId = user.companyId;

  // 1. Branch Reconciliation
  if (companyId) {
    const branchCount = await Branch.countDocuments({ companyId });
    if (branchCount === 0) {
      if (user.branchId !== null || user.branchCreated !== false) {
        needsUpdate = true;
        updateFields.branchId = null;
        updateFields.branchCreated = false;
      }
    } else {
      // Branches exist in DB for this company. Check if user.branchId is valid
      const validBranch = user.branchId
        ? await Branch.findOne({ _id: user.branchId, companyId })
        : null;

      if (!validBranch) {
        needsUpdate = true;
        const remainingBranch = await Branch.findOne({ companyId }).sort({ isHeadOffice: -1 });
        updateFields.branchId = remainingBranch._id;
        updateFields.branchCreated = true;
      } else if (!user.branchCreated) {
        needsUpdate = true;
        updateFields.branchCreated = true;
      }
    }
  } else {
    if (user.branchId !== null || user.branchCreated !== false) {
      needsUpdate = true;
      updateFields.branchId = null;
      updateFields.branchCreated = false;
    }
  }

  // Active branch ID for FY lookup
  const activeBranchId = updateFields.branchId !== undefined ? updateFields.branchId : user.branchId;

  // 2. Financial Year Reconciliation
  if (activeBranchId) {
    const fyCount = await FinancialYear.countDocuments({ branchId: activeBranchId });
    if (fyCount === 0) {
      if (user.financialYearId !== null || user.financialYearCreated !== false) {
        needsUpdate = true;
        updateFields.financialYearId = null;
        updateFields.financialYearCreated = false;
      }
    } else {
      const validFy = user.financialYearId
        ? await FinancialYear.findOne({ _id: user.financialYearId, branchId: activeBranchId })
        : null;

      if (!validFy) {
        needsUpdate = true;
        const remainingFy = await FinancialYear.findOne({ branchId: activeBranchId }).sort({ startDate: -1 });
        updateFields.financialYearId = remainingFy._id;
        updateFields.financialYearCreated = true;
      } else if (!user.financialYearCreated) {
        needsUpdate = true;
        updateFields.financialYearCreated = true;
      }
    }
  } else {
    if (user.financialYearId !== null || user.financialYearCreated !== false) {
      needsUpdate = true;
      updateFields.financialYearId = null;
      updateFields.financialYearCreated = false;
    }
  }

  if (needsUpdate) {
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updateFields },
      { new: true }
    );
    return updatedUser || user;
  }

  return user;
};

/**
 * Scan all users in the database and fix any orphaned branchId / financialYearId references.
 */
const cleanupAllOrphanedUsers = async () => {
  try {
    const users = await User.find({});

    let cleanedCount = 0;
    for (const user of users) {
      const updated = await reconcileUserOrphanedReferences(user);
      if (updated && (
        updated.branchCreated !== user.branchCreated ||
        updated.financialYearCreated !== user.financialYearCreated ||
        String(updated.branchId) !== String(user.branchId) ||
        String(updated.financialYearId) !== String(user.financialYearId)
      )) {
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`🧹 Cleaned up orphaned branch/FY references for ${cleanedCount} user(s).`);
    }
    return cleanedCount;
  } catch (error) {
    logger.error(`Error during cleanup of orphaned users: ${error.message}`);
    return 0;
  }
};

module.exports = {
  reconcileUserOrphanedReferences,
  cleanupAllOrphanedUsers
};
