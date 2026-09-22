const FinanceUser = require('../models/FinanceUser');
const Company = require('../models/Company');
const userService = require('../services/user.service');
const { inviteUserSchema, updateUserSchema } = require('../validators/user.validators');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user — Invite / add a user to a company
// ─────────────────────────────────────────────────────────────────────────────

const inviteUser = async (req, res, next) => { 
  try {
    const parsed = inviteUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed', 
        details: parsed.error.errors
      });
    }

    const { companyId, branchId, name, email, phone, phoneNumber, role, sendTemporaryPassword } = parsed.data;

    // Fetch company name for the invite email subject
    const company = await Company.findById(companyId).select('name');
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
        errorCode: 'COMPANY_NOT_FOUND' 
      });
    }

    if (branchId) {
      const Branch = require('../models/Branch');
      const branchDoc = await Branch.findOne({ _id: branchId, companyId });
      if (!branchDoc) {
        return res.status(400).json({
          success: false,
          message: 'Branch not found or does not belong to the specified company',
          errorCode: 'INVALID_BRANCH'
        });
      }
    }

    const host = req.get('host');
    const protocol = host.includes('localhost') ? req.protocol : 'https';
    const baseUrl = `${protocol}://${host}`;

    let result;
    try {
      result = await userService.inviteUser({ companyId, branchId, name, email, phoneNumber: phoneNumber ?? phone, role, companyName: company.name, sendTemporaryPassword, baseUrl });
    } catch (err) {
      if (err.statusCode === 409) {
        return res.status(409).json({
          success: false,
          message: err.message,
          errorCode: err.errorCode
        });
      }
      throw err;
    }

    const { isNewUser, user } = result;

    const financeUser = await FinanceUser.findOne({ userId: user._id })
      .populate('userId', 'name email phoneNumber')
      .lean();
    const financeIdentity = financeUser?.userId || user;
    const assignedBranchId = branchId || financeUser?.branchId;
    let branchName = null;
    if (assignedBranchId) {
      const Branch = require('../models/Branch');
      const branchDoc = await Branch.findById(assignedBranchId).select('branchName').lean();
      if (branchDoc) branchName = branchDoc.branchName;
    }

    return res.status(isNewUser ? 201 : 200).json({
      success: true,
      message: isNewUser
        ? 'User invited successfully. An email has been sent.'
        : 'Existing user granted access to this company.',
      data: {
        userId: financeIdentity._id,
        email: financeIdentity.email,
        phoneNumber: financeIdentity.phoneNumber || null,
        companyId,
        branchId: assignedBranchId ? assignedBranchId.toString() : null,
        branchName: branchName || null,
        role
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user?companyId= — List users with access to a company
// ─────────────────────────────────────────────────────────────────────────────

const listUsers = async (req, res, next) => {
  try {
    const { search, includeInactive, companyId: queryCompanyId } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

    let companyId = queryCompanyId || req.user?.companyId;

    if (!companyId && req.user?.companyAccess?.length > 0) {
      const activeCompany = req.user.companyAccess.find((c) => c.isActive);
      if (activeCompany) companyId = activeCompany.companyId;
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID not found',
        errorCode: 'COMPANY_ID_REQUIRED'
      });
    }

    const financeFilter = {
      $or: [
        { companyId },
        {
          companyAccess: {
            $elemMatch: {
              companyId,
              ...(includeInactive === "true" ? {} : { isActive: true })
            }
          }
        }
      ]
    };

    const financeUsers = await FinanceUser.find(financeFilter)
      .populate('userId', 'name email phoneNumber')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const usersWithFinance = financeUsers
      .map((financeUser) => ({
        ...(financeUser.userId || {}),
        ...financeUser,
        _id: financeUser.userId?._id || financeUser.userId,
        companyId: financeUser.companyId,
        branchId: financeUser.branchId,
      }))
      .filter((user) => (!search || new RegExp(search, 'i').test(user.name || '') || new RegExp(search, 'i').test(user.email || '')) && (user.name || user.email));

    const total = await FinanceUser.countDocuments(financeFilter);

    // Map branch names for users
    const branchIds = new Set();
    usersWithFinance.forEach((u) => {
      if (u.branchId) branchIds.add(u.branchId.toString());
      (u.companyAccess || []).forEach((a) => {
        if (a.branchId) branchIds.add(a.branchId.toString());
      });
    });

    const Branch = require('../models/Branch');
    const branches = await Branch.find({ _id: { $in: Array.from(branchIds) } }).select('branchName').lean();
    const branchMap = new Map(branches.map((b) => [b._id.toString(), b.branchName]));

    const data = usersWithFinance.map((user) =>
      userService.toCompanyUserView(user, companyId, branchMap)
    );

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/user/:id — Update role / active status / profile fields
// ─────────────────────────────────────────────────────────────────────────────

const updateUser = async (req, res, next) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        details: parsed.error.errors
      });
    }

    const { companyId, branchId, role, isActive, name, phone, phoneNumber } = parsed.data;
    const targetUserId = req.params.id;

    if (branchId) {
      const Branch = require('../models/Branch');
      const branchDoc = await Branch.findOne({ _id: branchId, companyId });
      if (!branchDoc) {
        return res.status(400).json({
          success: false,
          message: 'Branch not found or does not belong to the specified company',
          errorCode: 'INVALID_BRANCH'
        });
      }
    }

    const financeUser = await FinanceUser.findOne({ userId: targetUserId })
      .populate('userId', 'name email phoneNumber role companyId branchId companyCreated companyAccess')
      .exec();
    const targetUser = financeUser?.userId;
    if (!financeUser || !targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    // Find the companyAccess entry for this company
    let accessEntry = financeUser.companyAccess.find(
      (a) => a.companyId.toString() === companyId.toString()
    );
    if (!accessEntry) {
      return res.status(404).json({
        success: false,
        message: 'This user does not have access to the specified company',
        errorCode: 'ACCESS_ENTRY_NOT_FOUND'
      });
    }

    // Self-lockout guard
    if (isActive === false) {
      if (userService.wouldSelfLockout(req.user, targetUserId, companyId)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own only remaining company access',
          errorCode: 'SELF_LOCKOUT_PREVENTED'
        });
      }
    }

    // Apply companyAccess-scoped changes
    if (role !== undefined) {
      accessEntry.role = role;
      targetUser.role = role;
    }
    if (branchId !== undefined) {
      const finalBranchId = branchId ? branchId : null;
      accessEntry.branchId = finalBranchId;
      financeUser.branchId = finalBranchId;
    }
    if (isActive !== undefined) accessEntry.isActive = isActive;

    // Apply global profile changes
    if (name !== undefined) targetUser.name = name;
    if (phone !== undefined || phoneNumber !== undefined) {
      targetUser.phoneNumber = phoneNumber ?? phone;
    }

    await financeUser.save();
    await targetUser.save();

    const { invalidateUserCache } = require('../middleware/authenticate');
    invalidateUserCache(targetUserId);

    const assignedBranchId = accessEntry.branchId || financeUser.branchId || targetUser.branchId;
    let branchName = null;
    if (assignedBranchId) {
      const Branch = require('../models/Branch');
      const branchDoc = await Branch.findById(assignedBranchId).select('branchName').lean();
      if (branchDoc) branchName = branchDoc.branchName;
    }
    const branchMap = new Map();
    if (assignedBranchId && branchName) {
      branchMap.set(assignedBranchId.toString(), branchName);
    }

    return res.status(200).json({
      success: true,
      data: userService.toCompanyUserView(targetUser, companyId, branchMap)
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/:id?companyId= — Get details of a single user
// ─────────────────────────────────────────────────────────────────────────────

const getUserById = async (req, res, next) => {
  try {
    const { companyId: queryCompanyId } = req.query;
    const targetUserId = req.params.id;
    let companyId = queryCompanyId || req.user?.companyId;

    if (!companyId && req.user?.companyAccess?.length > 0) {
      const activeCompany = req.user.companyAccess.find((c) => c.isActive);
      if (activeCompany) companyId = activeCompany.companyId;
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId query parameter is required',
        errorCode: 'COMPANY_ID_REQUIRED'
      });
    }

    const financeUser = await FinanceUser.findOne({ userId: targetUserId })
      .populate('userId', 'name email phoneNumber role companyId branchId companyCreated companyAccess')
      .lean();
    const targetUser = financeUser?.userId;
    if (!financeUser || !targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const accessEntry = (financeUser.companyAccess || []).find(
      (a) => a.companyId.toString() === companyId.toString()
    );

    const assignedBranchId = accessEntry?.branchId || financeUser.branchId;
    let branchName = null;
    if (assignedBranchId) {
      const Branch = require('../models/Branch');
      const branchDoc = await Branch.findById(assignedBranchId).select('branchName').lean();
      if (branchDoc) branchName = branchDoc.branchName;
    }

    const branchMap = new Map();
    if (assignedBranchId && branchName) {
      branchMap.set(assignedBranchId.toString(), branchName);
    }

    return res.status(200).json({
      success: true,
      data: userService.toCompanyUserView(targetUser, companyId, branchMap)
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/user/:id?companyId= — Revoke a user's access to a company
// ─────────────────────────────────────────────────────────────────────────────

const revokeAccess = async (req, res, next) => {
  try {
    const { companyId } = req.query;
    const targetUserId = req.params.id;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'companyId query parameter is required',
        errorCode: 'COMPANY_ID_REQUIRED'
      });
    }

    const financeUser = await FinanceUser.findOne({ userId: targetUserId })
      .populate('userId', 'name email phoneNumber')
      .exec();
    if (!financeUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const accessEntry = financeUser.companyAccess.find(
      (a) => a.companyId.toString() === companyId.toString()
    );
    if (!accessEntry) {
      return res.status(404).json({
        success: false,
        message: 'This user does not have access to the specified company',
        errorCode: 'ACCESS_ENTRY_NOT_FOUND'
      });
    }

    // Self-lockout guard
    if (userService.wouldSelfLockout(req.user, targetUserId, companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own only remaining company access',
        errorCode: 'SELF_LOCKOUT_PREVENTED'
      });
    }

    // Soft revoke — preserve the user and their history
    accessEntry.isActive = false;
    await financeUser.save();

    return res.status(200).json({
      success: true,
      message: 'User access revoked for this company'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  inviteUser,
  listUsers,
  getUserById,
  updateUser,
  revokeAccess
};
