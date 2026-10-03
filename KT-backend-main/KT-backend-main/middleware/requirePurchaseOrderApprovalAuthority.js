const Role = require('../models/Role');

/**
 * Middleware to check if the authenticated user has Admin or Super Admin authority
 * for the target company associated with the Purchase Order.
 */
const requirePurchaseOrderApprovalAuthority = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Resolve companyId: PO is attached by the checkCompanyAccess (access) middleware
    const companyId = req.purchaseOrder?.companyId || req.body.companyId || req.query.companyId || user.companyId;
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required for role validation'
      });
    }

    const ALLOWED_ROLES = ['Admin', 'Super Admin', 'SUPER_ADMIN', 'ADMIN'];
    const checkRoleName = (name) => {
      if (!name) return false;
      const normalized = name.toLowerCase().replace(/_/g, ' ').trim();
      return ALLOWED_ROLES.includes(name) || ['admin', 'super admin', 'super_admin'].includes(normalized);
    };

    let resolvedRole = null;

    // 1. Check company-specific companyAccess sub-document (Module 16 and Module 23)
    if (user.companyAccess && Array.isArray(user.companyAccess)) {
      const access = user.companyAccess.find(
        (a) => a.companyId && a.companyId.toString() === companyId.toString() && a.isActive
      );
      if (access) {
        if (access.roleId) {
          const roleDoc = await Role.findById(access.roleId);
          if (roleDoc) resolvedRole = roleDoc.name;
        } else if (access.role) {
          resolvedRole = access.role;
        }
      }
    }

    // 2. Fallback to direct user roleId (if any)
    if (!resolvedRole && user.roleId) {
      const roleDoc = await Role.findById(user.roleId);
      if (roleDoc) resolvedRole = roleDoc.name;
    }

    // 3. Fallback to legacy flat user role string (Module 1 bootstrap)
    if (!resolvedRole && user.role) {
      resolvedRole = user.role;
    }

    if (checkRoleName(resolvedRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Only Admin or Super Admin can approve or reject purchase orders.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = requirePurchaseOrderApprovalAuthority;
