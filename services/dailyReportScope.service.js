const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const User = require('../models/User');

const resolveDailyReportCompanyId = async (employeeId, authenticatedUser) => {
  if (mongoose.Types.ObjectId.isValid(employeeId)) {
    const [user, employee] = await Promise.all([
      User.findById(employeeId).select('companyId').lean(),
      Employee.findOne({
        $or: [
          { _id: employeeId },
          { userID: employeeId },
          { userId: employeeId },
        ],
      }).select('companyId userID userId').lean(),
    ]);

    if (user?.companyId) return user.companyId;
    if (employee?.companyId) return employee.companyId;

    const linkedUserId = employee?.userID || employee?.userId;
    if (linkedUserId) {
      const linkedUser = await User.findById(linkedUserId)
        .select('companyId')
        .lean();
      if (linkedUser?.companyId) return linkedUser.companyId;
    }
  }

  return authenticatedUser?.companyId || null;
};

module.exports = { resolveDailyReportCompanyId };
