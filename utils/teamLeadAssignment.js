const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");

const resolveIdentifier = (value) => {
  if (!value) return "";
  if (typeof value !== "object") return String(value).trim();

  return String(
    value._id ||
    value.id ||
    value.userId ||
    value.userID ||
    value.employeeId ||
    value.employeeID ||
    value.uniqueID ||
    value.employeeCode ||
    value.email ||
    value.value ||
    "",
  ).trim();
};

const assignEmployeeToTeamLead = async ({ employee, user, teamLead }) => {
  const identifier = resolveIdentifier(teamLead);
  if (!employee || !identifier) return null;

  const objectId = /^[a-f\d]{24}$/i.test(identifier) ? identifier : null;
  let leadUser = objectId ? await User.findById(objectId) : null;
  let leadEmployee = objectId ? await Employee.findById(objectId) : null;

  if (!leadUser) {
    leadUser = await User.findOne({
      $or: [{ uniqueID: identifier }, { email: identifier }],
    });
  }

  if (!leadEmployee) {
    leadEmployee = await Employee.findOne({
      $or: [
        { employeeID: identifier },
        { employeeCode: identifier },
        { email: identifier },
        ...(leadUser ? [{ userID: leadUser._id }, { userId: leadUser._id }] : []),
      ],
    });
  }

  if (!leadUser && leadEmployee) {
    leadUser = await User.findOne({
      $or: [
        ...(leadEmployee.userID ? [{ _id: leadEmployee.userID }] : []),
        ...(leadEmployee.userId ? [{ _id: leadEmployee.userId }] : []),
        ...(leadEmployee.email ? [{ email: leadEmployee.email }] : []),
      ],
    });
  }

  if (!leadUser && !leadEmployee) return null;

  if (!leadEmployee && leadUser) {
    leadEmployee = await Employee.findOne({
      $or: [{ userID: leadUser._id }, { userId: leadUser._id }],
    });
  }

  let team = await Team.findOne({
    $or: [
      ...(leadUser ? [{ teamLeadUser: leadUser._id }] : []),
      ...(leadEmployee ? [{ teamLeadEmployee: leadEmployee._id }] : []),
    ],
  });

  if (!team) {
    const leadName =
      leadUser?.name ||
      `${leadEmployee?.firstName || ""} ${leadEmployee?.lastName || ""}`.trim() ||
      "Team Lead";
    team = await Team.create({
      name: `${leadName} Team`,
      teamLeadUser: leadUser?._id || null,
      teamLeadEmployee: leadEmployee?._id || null,
      teamLeadId:
        leadUser?.uniqueID ||
        leadEmployee?.employeeID ||
        leadEmployee?.employeeCode ||
        "",
      employees: [],
      interns: [],
    });
  }

  if (!team.employees.some((id) => String(id) === String(employee._id))) {
    team.employees.push(employee._id);
    await team.save();
  }

  return team;
};

module.exports = {
  resolveIdentifier,
  assignEmployeeToTeamLead,
};
