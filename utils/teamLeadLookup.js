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

  let directTeamLead = null;
  if (employee) {
    const linkedEmployee = await Employee.findById(employee._id)
      .select("teamLeadUser teamLeadEmployee teamLeadId")
      .lean();
    if (linkedEmployee) {
      directTeamLead = linkedEmployee;
      teamLeadConditions.push(
        ...(linkedEmployee.teamLeadUser ? [{ teamLeadUser: linkedEmployee.teamLeadUser }] : []),
        ...(linkedEmployee.teamLeadEmployee ? [{ teamLeadEmployee: linkedEmployee.teamLeadEmployee }] : []),
        ...(linkedEmployee.teamLeadId ? [{ teamLeadId: linkedEmployee.teamLeadId }] : []),
      );
    }
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

  if (!team && !directTeamLead?.teamLeadUser && !directTeamLead?.teamLeadEmployee && !directTeamLead?.teamLeadId) {
    return null;
  }

  let [leadUser, leadEmployee] = await Promise.all([
    team?.teamLeadUser || directTeamLead?.teamLeadUser
      ? User.findById(team?.teamLeadUser || directTeamLead?.teamLeadUser)
          .select("_id name email role uniqueID")
          .lean()
      : null,
    team?.teamLeadEmployee || directTeamLead?.teamLeadEmployee
      ? Employee.findById(team?.teamLeadEmployee || directTeamLead?.teamLeadEmployee)
          .select("_id firstName lastName name email role employeeID employeeCode designation department")
          .lean()
      : null,
  ]);

  const teamLeadId = team?.teamLeadId || directTeamLead?.teamLeadId || "";
  if (teamLeadId && (!leadUser || !leadEmployee)) {
    const [legacyUser, legacyEmployee] = await Promise.all([
      leadUser
        ? null
        : User.findOne({ uniqueID: teamLeadId })
            .select("_id name email role uniqueID")
            .lean(),
      leadEmployee
        ? null
        : Employee.findOne({
            $or: [
              { employeeID: teamLeadId },
              { employeeCode: teamLeadId },
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
    uniqueID: leadUser?.uniqueID || teamLeadId || "",
    employeeID:
      leadEmployee?.employeeID ||
      leadEmployee?.employeeCode ||
      teamLeadId ||
      "",
    designation: leadEmployee?.designation || "",
    department: leadEmployee?.department || null,
  };
};

module.exports = { getTeamLeadForUser };
