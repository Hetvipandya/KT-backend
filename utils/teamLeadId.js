const User = require("../models/User");
const Employee = require("../models/Employee");

/**
 * Generate a unique ID for Team Lead (Format: TL0001, TL0002, etc.)
 */
const generateTeamLeadID = async () => {
  let maxNum = 0;

  // 1. Scan User collection for uniqueIDs starting with TL
  const users = await User.find({
    $or: [
      { role: { $in: ["team lead", "teamlead", "TeamLead", "Team Lead"] } },
      { uniqueID: { $regex: /^TL\d+$/i } },
    ],
  })
    .select("uniqueID")
    .lean();

  users.forEach((u) => {
    if (u.uniqueID && /^TL\d+$/i.test(u.uniqueID)) {
      const num = parseInt(u.uniqueID.replace(/^TL/i, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });

  // 2. Scan Employee collection for employeeIDs starting with TL
  const employees = await Employee.find({
    $or: [
      { isTeamLead: true },
      { role: "team lead" },
      { employeeID: { $regex: /^TL\d+$/i } },
      { employeeCode: { $regex: /^TL\d+$/i } },
    ],
  })
    .select("employeeID employeeCode")
    .lean();

  employees.forEach((e) => {
    const id = e.employeeID || e.employeeCode;
    if (id && /^TL\d+$/i.test(id)) {
      const num = parseInt(id.replace(/^TL/i, ""), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });

  // 3. Increment and ensure uniqueness
  let nextNum = maxNum + 1;
  let candidateID = `TL${String(nextNum).padStart(4, "0")}`;

  while (
    (await User.exists({ uniqueID: candidateID })) ||
    (await Employee.exists({ $or: [{ employeeID: candidateID }, { employeeCode: candidateID }] }))
  ) {
    nextNum += 1;
    candidateID = `TL${String(nextNum).padStart(4, "0")}`;
  }

  return candidateID;
};

const mongoose = require("mongoose");

/**
 * Ensure a User and/or Employee associated with a Team Lead has a valid unique ID.
 * Stores it on User.uniqueID, Employee.employeeID, and returns it.
 */
const ensureTeamLeadUniqueID = async ({ user, employee, team }) => {
  let existingID =
    user?.uniqueID ||
    employee?.employeeID ||
    employee?.employeeCode ||
    team?.teamLeadId;

  // If no ID exists at all, generate a new TL unique ID
  if (!existingID) {
    existingID = await generateTeamLeadID();
  }

  // Update User if needed
  if (user) {
    user.uniqueID = user.uniqueID || existingID;
    if (typeof user.save === "function") {
      await user.save();
    } else if (user._id && mongoose.Types.ObjectId.isValid(user._id)) {
      await User.findByIdAndUpdate(user._id, { uniqueID: existingID });
    }
  }

  // Update Employee if needed
  if (employee) {
    employee.employeeID = employee.employeeID || existingID;
    employee.employeeCode = employee.employeeCode || existingID;
    if (typeof employee.save === "function") {
      await employee.save();
    } else if (employee._id && mongoose.Types.ObjectId.isValid(employee._id)) {
      await Employee.findByIdAndUpdate(employee._id, {
        employeeID: employee.employeeID,
        employeeCode: employee.employeeCode,
      });
    }
  }

  // Update Team if needed
  if (team) {
    team.teamLeadId = existingID;
    if (typeof team.save === "function") {
      await team.save();
    } else if (team._id && mongoose.Types.ObjectId.isValid(team._id)) {
      const Team = require("../models/Team");
      await Team.findByIdAndUpdate(team._id, { teamLeadId: existingID });
    }
  }

  return existingID;
};

module.exports = {
  generateTeamLeadID,
  ensureTeamLeadUniqueID,
};
