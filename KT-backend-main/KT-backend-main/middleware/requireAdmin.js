const Company = require('../models/Company');

const requireAdmin = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let companyId = req.company?._id || req.body?.companyId || req.query?.companyId || user.companyId || (user.companyAccess?.find(a => a.isActive)?.companyId);

    if (!companyId) {
      const createdCompany = await Company.findOne({ createdBy: user._id });
      if (createdCompany) companyId = createdCompany._id;
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required for access validation',
        errorCode: 'COMPANY_ID_REQUIRED'
      });
    }

    // 1. Fetch the company to check the creator (owner is admin by default)
    let company = await Company.findById(companyId);
    if (!company) {
      company = await Company.findOne({ createdBy: user._id });
    }

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
        errorCode: 'COMPANY_NOT_FOUND'
      });
    }

    const isOwner = company.createdBy.toString() === user._id.toString();
    if (isOwner) {
      return next();
    }

    // 2. Otherwise, check user's companyAccess role
    const accessEntry = (user.companyAccess || []).find(
      (access) => access.isActive && access.companyId.toString() === company.id
    );

    if (!accessEntry) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this company\'s data',
        errorCode: 'FORBIDDEN'
      });
    }

    if (accessEntry.role.toLowerCase() !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only admins are allowed to perform this action',
        errorCode: 'FORBIDDEN'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = requireAdmin;
