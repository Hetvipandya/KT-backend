/**
 * Select the company context used immediately after login. Invited users such
 * as CAs and Accountants keep their company membership in `companyAccess`,
 * while company owners use the legacy top-level `companyId` field.
 */
const resolveLoginCompanyContext = (user) => {
  const activeAccess = user.companyId
    ? (user.companyAccess || []).find((access) => (
      access.isActive !== false && access.companyId.toString() === user.companyId.toString()
    ))
    : (user.companyAccess || []).find((access) => access.isActive !== false);

  const branchId = activeAccess?.branchId || user.branchId || null;

  return {
    companyId: activeAccess?.companyId || user.companyId || null,
    branchId: branchId ? (typeof branchId === 'object' && branchId._id ? branchId._id : branchId) : null,
    // A company-specific role must take precedence over the legacy global role.
    role: activeAccess?.role || user.role || 'user',
    hasCompanyAccess: Boolean(activeAccess)
  };
};

const determineNextStep = (user) => {
  const { hasCompanyAccess } = resolveLoginCompanyContext(user);
  if (hasCompanyAccess) return 'DASHBOARD';
  if (!user.companyCreated) return 'CREATE_COMPANY';
  if (!user.branchCreated) return 'CREATE_BRANCH';
  if (!user.financialYearCreated) return 'CREATE_FINANCIAL_YEAR';
  return 'DASHBOARD';
};

const shapeOnboardingUser = async (user) => {
  const { companyId, branchId, role } = resolveLoginCompanyContext(user);

  let branchName = null;
  const targetBranchId = branchId ? branchId.toString() : null;

  if (targetBranchId) {
    try {
      const Branch = require('../models/Branch');
      const branchDoc = await Branch.findById(targetBranchId).select('branchName').lean();
      if (branchDoc) {
        branchName = branchDoc.branchName;
      }
    } catch (err) {
      // Ignore lookup error if branch model not ready or branch not found
    }
  }

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    companyId: companyId ? companyId.toString() : null,
    branchId: targetBranchId,
    branchName: branchName || null,
    role,
    companyCreated: Boolean(user.companyCreated),
    branchCreated: Boolean(user.branchCreated),
    financialYearCreated: Boolean(user.financialYearCreated)
  };
};

const buildUserOnboardingResponse = async (user) => {
  const nextStep = determineNextStep(user);
  const shapedUser = await shapeOnboardingUser(user);

  return {
    user: shapedUser,
    // Kept at the data level as a convenience for existing mobile clients.
    companyId: shapedUser.companyId,
    branchId: shapedUser.branchId,
    branchName: shapedUser.branchName,
    role: shapedUser.role,
    nextStep,
    redirectTo: nextStep === 'DASHBOARD' ? 'DASHBOARD' : 'COMPANY_REGISTRATION'
  };
};

module.exports = {
  determineNextStep,
  resolveLoginCompanyContext,
  shapeOnboardingUser,
  buildUserOnboardingResponse
};
