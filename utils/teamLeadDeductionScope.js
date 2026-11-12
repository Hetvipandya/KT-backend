const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const Team = require("../models/Team");

const getReferenceId = (value) => {
  if (!value) return null;
  const id = typeof value === "object" ? value._id || value.id : value;
  return mongoose.Types.ObjectId.isValid(id) ? String(id) : null;
};

const getTeamMemberDeductionQuery = async (teamLead) => {
  const teamLeadUserId = getReferenceId(teamLead?._id);
  if (!teamLeadUserId) return { _id: { $in: [] } };

  const leadEmployee = await Employee.findOne({
    $or: [{ userID: teamLeadUserId }, { userId: teamLeadUserId }],
  })
    .select("_id employeeID employeeCode")
    .lean();

  const leadEmployeeId = getReferenceId(leadEmployee?._id);
  const leadIdentifiers = [
    teamLeadUserId,
    teamLead?.uniqueID,
    leadEmployee?.employeeID,
    leadEmployee?.employeeCode,
  ].filter(Boolean).map(String);

  const teamConditions = [{ teamLeadUser: teamLeadUserId }];
  const directAssignmentConditions = [{ teamLeadUser: teamLeadUserId }];
  if (leadEmployeeId) {
    teamConditions.push({ teamLeadEmployee: leadEmployeeId });
    directAssignmentConditions.push({ teamLeadEmployee: leadEmployeeId });
  }
  if (leadIdentifiers.length) {
    teamConditions.push({ teamLeadId: { $in: leadIdentifiers } });
    directAssignmentConditions.push({ teamLeadId: { $in: leadIdentifiers } });
  }

  const [teams, directlyAssignedEmployees] = await Promise.all([
    Team.find({ $or: teamConditions })
      .select("employees interns developers designers testers")
      .lean(),
    Employee.find({ $or: directAssignmentConditions })
      .select("_id userID userId")
      .lean(),
  ]);

  const teamMemberIds = teams.flatMap((team) =>
    ["employees", "interns", "developers", "designers", "testers"]
      .flatMap((field) => Array.isArray(team[field]) ? team[field] : [])
      .map(getReferenceId)
      .filter(Boolean)
  );
  const uniqueTeamMemberIds = [...new Set(teamMemberIds)];
  const teamMembers = uniqueTeamMemberIds.length
    ? await Employee.find({
      $or: [
        { _id: { $in: uniqueTeamMemberIds } },
        { userID: { $in: uniqueTeamMemberIds } },
        { userId: { $in: uniqueTeamMemberIds } },
      ],
    }).select("_id userID userId").lean()
    : [];

  const employeeIds = new Set();
  const userIds = new Set();
  const excludedIds = new Set([teamLeadUserId, leadEmployeeId].filter(Boolean));
  for (const employee of [...directlyAssignedEmployees, ...teamMembers]) {
    const employeeId = getReferenceId(employee._id);
    const userId = getReferenceId(employee.userID || employee.userId);
    if (employeeId && !excludedIds.has(employeeId)) employeeIds.add(employeeId);
    if (userId && !excludedIds.has(userId)) userIds.add(userId);
  }

  const deductionScopes = [];
  if (employeeIds.size) {
    deductionScopes.push({ employeeId: { $in: [...employeeIds] } });
  }
  if (userIds.size) {
    deductionScopes.push(
      { employeeId: { $in: [...userIds] } },
      { userId: { $in: [...userIds] } }
    );
  }

  return deductionScopes.length
    ? {
      $and: [
        { $or: deductionScopes },
        { $nor: [{ employeeId: { $in: [...excludedIds] } }, { userId: { $in: [...excludedIds] } }] },
      ],
    }
    : { _id: { $in: [] } };
};

module.exports = { getTeamMemberDeductionQuery };
