const Employee = require("../models/Employee");

const isEmployeeRole = (role) => {
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  return ["employee", "teamlead", "teamleader"].includes(normalizedRole);
};

const isEmployeeLoginBlocked = async (user) => {
  if (!user || !isEmployeeRole(user.role)) {
    return false;
  }

  const employeeConditions = [];
  if (user._id) {
    employeeConditions.push({ userID: user._id }, { userId: user._id });
  }
  if (user.email) {
    employeeConditions.push({ email: String(user.email).trim().toLowerCase() });
  }

  if (employeeConditions.length === 0) {
    return false;
  }

  const employee = await Employee.findOne({ $or: employeeConditions }).select(
    "employeeStatus currentAction status",
  );

  if (!employee) {
    return false;
  }

  const unavailableStatuses = new Set([
    "resigned",
    "resignation",
    "terminated",
    "exit",
  ]);
  const values = [
    employee.employeeStatus,
    employee.currentAction,
    employee.status,
  ];

  return values.some((value) =>
    unavailableStatuses.has(
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ""),
    ),
  );
};

module.exports = { isEmployeeLoginBlocked };
