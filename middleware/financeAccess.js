const normalizeRole = (role) => String(role || '')
  .trim()
  .toLowerCase()
  .replace(/[_\s-]+/g, '');

const idOf = (value) => {
  if (!value) return '';
  return String(value._id || value.id || value);
};

const READ_ROLES = ['admin', 'superadmin', 'ca', 'accountant', 'hr'];
const BANK_READ_ROLES = ['admin', 'superadmin', 'ca', 'accountant'];
const ENTRY_ROLES = ['admin', 'superadmin', 'ca', 'accountant'];
const WRITE_ROLES = ['admin', 'superadmin', 'ca'];

const getCompanyAccessEntry = (user, companyId) =>
  (Array.isArray(user?.companyAccess) ? user.companyAccess : []).find(
    (access) => access?.isActive !== false &&
      idOf(access.companyId) === idOf(companyId)
  );

const getEffectiveCompanyRole = (user, companyId) => {
  const globalRole = normalizeRole(user?.role);
  if (globalRole === 'superadmin') return globalRole;

  const access = getCompanyAccessEntry(user, companyId);
  if (access) return normalizeRole(access.role);

  return idOf(user?.companyId) === idOf(companyId) ||
    (Array.isArray(user?.companyAccess) && user.companyAccess.length === 0)
    ? globalRole
    : '';
};

const hasFinanceCompanyAccess = (user, company) => {
  const companyId = idOf(company);
  if (!user || !companyId) return false;
  if (normalizeRole(user.role) === 'superadmin') return true;
  if (company?.createdBy && idOf(company.createdBy) === idOf(user._id || user.id)) return true;
  if (idOf(user.companyId) === companyId) return true;
  return Boolean(getCompanyAccessEntry(user, companyId));
};

const hasFinanceRole = (user, companyId, roles) => {
  const role = getEffectiveCompanyRole(user, companyId);
  return Boolean(role && roles.map(normalizeRole).includes(role));
};

const requireFinanceCompanyAccess = (req, res, next) => {
  const company = req.company || (req.coa ? { _id: req.coa.companyId } : null);
  const companyId = idOf(company) ||
    idOf(req.body?.companyId) ||
    idOf(req.query?.companyId);
  const requestedCompanyId = idOf(req.body?.companyId) || idOf(req.query?.companyId);

  if (!companyId) {
    return res.status(400).json({
      success: false,
      message: 'Company ID is required for Finance access validation',
      errorCode: 'COMPANY_ID_REQUIRED'
    });
  }
  if (requestedCompanyId && requestedCompanyId !== companyId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to the requested company',
      errorCode: 'FORBIDDEN'
    });
  }
  if (!hasFinanceCompanyAccess(req.user, company || companyId)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have Finance access to this company',
      errorCode: 'FORBIDDEN'
    });
  }
  next();
};

const requireFinanceRole = (roles) => (req, res, next) => {
  const companyId = idOf(req.company) ||
    idOf(req.coa?.companyId) ||
    idOf(req.body?.companyId) ||
    idOf(req.query?.companyId);
  if (!hasFinanceRole(req.user, companyId, roles)) {
    return res.status(403).json({
      success: false,
      message: 'Your Finance role is not authorized to perform this action',
      errorCode: 'FINANCE_ROLE_FORBIDDEN'
    });
  }
  next();
};

module.exports = {
  READ_ROLES,
  BANK_READ_ROLES,
  ENTRY_ROLES,
  WRITE_ROLES,
  getEffectiveCompanyRole,
  hasFinanceCompanyAccess,
  hasFinanceRole,
  requireFinanceCompanyAccess,
  requireFinanceRole
};
