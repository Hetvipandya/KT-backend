const Branch = require('../models/Branch');
const FinancialYear = require('../models/FinancialYear');
const { determineNextStep } = require('../utils/onboarding');

const requireOnboarding = async (req, res, next) => {
  try {
    const user = req.user;
    const company = req.company;

    // If the user is not the owner/creator of the company, bypass onboarding checks
    if (company && company.createdBy && company.createdBy.toString() !== user._id.toString()) {
      return next();
    }

    // Calculate onboarding completion from user document or persisted company entities
    const companyCreated = user.companyCreated || !!company;
    const branchCreated = user.branchCreated || !!req.branchId || (company && await Branch.exists({ companyId: company._id }));
    const financialYearCreated = user.financialYearCreated || !!user.financialYearId || (company && await FinancialYear.exists({ companyId: company._id }));

    if (!companyCreated || !branchCreated || !financialYearCreated) {
      return res.status(403).json({
        success: false,
        message: 'Complete onboarding first.',
        nextStep: determineNextStep(user)
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = requireOnboarding;
