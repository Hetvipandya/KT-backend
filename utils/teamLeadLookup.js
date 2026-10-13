const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");

const getTeamLeadForUser = async (userId) => {
  const employee = await Employee.findOne({
    $or: [{ userID: userId }, { userId }],
  })
    .select("_id")
    .lean();

  const memberIds = [userId, employee?._id].filter(Boolean);
  const teamLeadConditions = [{ teamLeadUser: userId }];

  if (employee?._id) {
    teamLeadConditions.push({ teamLeadEmployee: employee._id });
  }

  const team = await Team.findOne({
    $or: [
      { employees: { $in: memberIds } },
      { interns: { $in: memberIds } },
      ...teamLeadConditions,
    ],
  })
    .select("teamLeadUser teamLeadEmployee teamLeadId")
    .lean();

  if (!team) {
    return null;
  }

  let [leadUser, leadEmployee] = await Promise.all([
    team.teamLeadUser
      ? User.findById(team.teamLeadUser)
          .select("_id name email role uniqueID")
          .lean()
      : null,
    team.teamLeadEmployee
      ? Employee.findById(team.teamLeadEmployee)
          .select("_id firstName lastName name email role employeeID employeeCode designation department")
          .lean()
      : null,
  ]);

  if (team.teamLeadId && (!leadUser || !leadEmployee)) {
    const [legacyUser, legacyEmployee] = await Promise.all([
      leadUser
        ? null
        : User.findOne({ uniqueID: team.teamLeadId })
            .select("_id name email role uniqueID")
            .lean(),
      leadEmployee
        ? null
        : Employee.findOne({
            $or: [
              { employeeID: team.teamLeadId },
              { employeeCode: team.teamLeadId },
            ],
          })
            .select("_id firstName lastName name email role employeeID employeeCode designation department")
            .lean(),
    ]);

    leadUser = leadUser || legacyUser;
    leadEmployee = leadEmployee || legacyEmployee;
  }

  if (!leadUser && !leadEmployee) {
    return null;
  }

  return {
    userId: leadUser?._id || null,
    employeeId: leadEmployee?._id || null,
    name:
      leadUser?.name ||
      leadEmployee?.name ||
      `${leadEmployee?.firstName || ""} ${leadEmployee?.lastName || ""}`.trim() ||
      "Unnamed",
    email: leadUser?.email || leadEmployee?.email || "",
    role: leadUser?.role || leadEmployee?.role || "team lead",
    uniqueID: leadUser?.uniqueID || team.teamLeadId || "",
    employeeID:
      leadEmployee?.employeeID ||
      leadEmployee?.employeeCode ||
      team.teamLeadId ||
      "",
    designation: leadEmployee?.designation || "",
    department: leadEmployee?.department || null,
  };
};

module.exports = { getTeamLeadForUser };
