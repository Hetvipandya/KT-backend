const mongoose =
  require("mongoose");

const Attendance =  
  require("../models/Attendance");

const DailyReport = 
  require("../models/DailyReport");
   
const Task = 
  require("../models/taskModel");

const User =
  require("../models/User");

const Employee = require("../models/Employee");

const Team =
  require("../models/Team");

const { ensureTeamLeadUniqueID } = require("../utils/teamLeadId");

/*
=========================
COMMON TEAM IDS
=========================
*/

const normalizeRole = (role) => {
  if (!role) return "";
  return String(role).trim().toLowerCase().replace(/[_\s]+/g, "");
};

const isTeamLeadRole = (role) => {
  const normalized = normalizeRole(role);
  return normalized === "teamlead" || normalized === "teamleader";
};

const resolveTeamLeadReference = async (teamLeadId) => {
  if (!teamLeadId) {
    return {
      teamLeadUser: null,
      teamLeadEmployee: null,
    };
  }

  const result = {
    teamLeadUser: null,
    teamLeadEmployee: null,
  };

  const user = await User.findById(teamLeadId);

  if (user) {
    result.teamLeadUser = user._id;
  }

  const employee = await Employee.findById(teamLeadId);

  if (employee) {
    result.teamLeadEmployee = employee._id;
  }

  if (!employee && user) {
    const linkedEmployee = await Employee.findOne({ userID: user._id });

    if (linkedEmployee) {
      result.teamLeadEmployee = linkedEmployee._id;
    }
  }

  if (!user && employee?.userID) {
    const linkedUser = await User.findById(employee.userID);

    if (linkedUser) {
      result.teamLeadUser = linkedUser._id;
    }
  }

  return result;
};

const findTeamByLead = async (teamLeadId) => {
  const leadReference = await resolveTeamLeadReference(teamLeadId);

  return await Team.findOne({
    $or: [
      { teamLeadUser: leadReference.teamLeadUser },
      { teamLeadEmployee: leadReference.teamLeadEmployee },
      { teamLeadUser: teamLeadId },
      { teamLeadEmployee: teamLeadId },
    ],
  });
};

const createTeamForLead = async (teamLeadId) => {
  const user = await User.findById(teamLeadId);
  const employee = await Employee.findById(teamLeadId);

  let teamLeadUser = null;
  let teamLeadEmployee = null;

  if (user) {
    teamLeadUser = user._id;
  }

  if (employee) {
    teamLeadEmployee = employee._id;
  }

  if (!teamLeadEmployee && user) {
    const linkedEmployee = await Employee.findOne({ userID: user._id });
    if (linkedEmployee) {
      teamLeadEmployee = linkedEmployee._id;
    }
  }

  if (!teamLeadUser && employee?.userID) {
    teamLeadUser = employee.userID;
  }

  return await Team.create({
    name: "",
    teamLeadUser,
    teamLeadEmployee,
    employees: [],
    interns: [],
  });
};

const getTeamIds = async (teamLeadId) => {
  console.log("Logged In Team Lead ID:", teamLeadId);

  const leadReference = await resolveTeamLeadReference(teamLeadId);

  const team =
    (await Team.findOne({
      $or: [
        { teamLeadUser: leadReference.teamLeadUser },
        { teamLeadEmployee: leadReference.teamLeadEmployee },
      ],
    })) ||
    (await Team.findOne({
      $or: [
        { teamLeadUser: teamLeadId },
        { teamLeadEmployee: teamLeadId },
      ],
    }));

  console.log("Team Found:", team);

  if (!team) return null;

  // Collect member ids from known arrays. Support both legacy fields
  // (developers/designers/testers) and current fields (employees/interns).
  const members = [];

  if (team.employees && team.employees.length) {
    members.push(...team.employees);
  }

  if (team.interns && team.interns.length) {
    members.push(...team.interns);
  }

  if (team.developers && team.developers.length) {
    members.push(...team.developers);
  }

  if (team.designers && team.designers.length) {
    members.push(...team.designers);
  }

  if (team.testers && team.testers.length) {
    members.push(...team.testers);
  }

  return members;
};

/*
=========================
DASHBOARD
=========================
*/

exports.getDashboard =
  async (req, res) => {
    try {
      const tlId =
        req.user._id;

      const teamIds =
        await getTeamIds(
          tlId
        );

      if (
        !teamIds
      ) {
        return res
          .status(404)
          .json({
            success:
              false,
            message:
              "No team found for this TL",
          });
      }

      const totalTeam =
        teamIds.length;

      const today =
        new Date();
      today.setHours(
        0,
        0,
        0,
        0
      );

      const todayAttendance =
        await Attendance.countDocuments(
          {
            userId: {
              $in:
                teamIds,
            },
            createdAt: {
              $gte:
                today,
            },
          }
        );

      const absentEmployees =
        totalTeam -
        todayAttendance;

      const pendingReports =
        await DailyReport.countDocuments(
          {
            userId: {
              $in:
                teamIds,
            },
            status:
              "pending",
          }
        );

      const pendingTasks =
        await Task.countDocuments(
          {
            assignedBy:
              tlId,
            status:
              "pending",
          }
        );

      const delayedTasks =
        await Task.countDocuments(
          {
            assignedBy:
              tlId,
            dueDate: {
              $lt:
                new Date(),
            },
            status: {
              $ne:
                "completed",
            },
          }
        );

      return res
        .status(200)
        .json({
          success:
            true,
          data: {
            totalTeam,
            todayAttendance,
            absentEmployees,
            pendingReports,
            pendingTasks,
            projectProgress:
              "In Progress",
            riskAlerts:
              delayedTasks,
            delayedTasks,
          },
        });
    } catch (
      error
    ) {
      console.log(
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,
          message:
            error.message,
        });
    }
  };

exports.createOrUpdateTeam = async (req, res) => {
  try {
    const {
      teamLead,
      name,
      employees = [],
      interns = [],
      developers = [], 
      designers = [],
      testers = [],
    } = req.body;

    console.log("📝 Creating/Updating Team:", { teamLead, employeesCount: employees.length, internsCount: interns.length });

    if (!teamLead) {
      return res.status(400).json({
        success: false,
        message: "Team Lead is required",
      });
    }

    // ===========================
    // STEP 1: Find the team lead (User or Employee)
    // ===========================
    
    const user = await User.findById(teamLead);
    const employee = await Employee.findById(teamLead);
    
    let teamLeadUser = null;
    let teamLeadEmployee = null;

    if (user) {
      if (user.role === "admin") {
        return res.status(400).json({
          success: false,
          message: "Admin user cannot be assigned as Team Lead",
        });
      }

      teamLeadUser = user._id;

      // Make this user a team lead if they are being used as one
      if (!isTeamLeadRole(user.role)) {
        user.role = "team lead";
        await user.save();
        console.log("✅ Updated user role to team lead");
      }

      // Link or create an employee record for this user
      let emp = await Employee.findOne({ userID: user._id });
      if (!emp) {
        emp = await Employee.create({
          userID: user._id,
          firstName: user.name?.split(' ')[0] || 'Team',
          lastName: user.name?.split(' ').slice(1).join(' ') || 'Lead',
          email: user.email,
          isTeamLead: true,
          department: user.department || null,
          mobile: user.phone || "",
          address: user.address || "",
          currentAddress: user.address || "",
          permanentAddress: user.address || "",
          designation: "Team Lead",
        });
        console.log("✅ Created new employee record for team lead user");
      } else if (!emp.isTeamLead) {
        emp.isTeamLead = true;
        await emp.save();
        console.log("✅ Updated employee to be team lead");
      }
      teamLeadEmployee = emp._id;
    }

    if (employee) {
      teamLeadEmployee = employee._id;

      if (!employee.isTeamLead) {
        employee.isTeamLead = true;
        await employee.save();
        console.log("✅ Marked employee as team lead");
      }

      if (employee.userID) {
        const usr = await User.findById(employee.userID);
        if (usr) {
          if (usr.role === "admin") {
            return res.status(400).json({
              success: false,
              message: "Admin user cannot be assigned as Team Lead",
            });
          }
          teamLeadUser = usr._id;
          if (!isTeamLeadRole(usr.role)) {
            usr.role = "team lead";
            await usr.save();
            console.log("✅ Updated linked user role to team lead");
          }
        }
      }
    }

    // If teamLead is a User ID but user wasn't found in User model,
    // lookup by employee record using that ID.
    if (!teamLeadUser && !teamLeadEmployee) {
      const empByUserID = await Employee.findOne({ userID: teamLead });
      if (empByUserID) {
        teamLeadEmployee = empByUserID._id;
        if (!empByUserID.isTeamLead) {
          empByUserID.isTeamLead = true;
          await empByUserID.save();
          console.log("✅ Marked employee as team lead by userID lookup");
        }
        if (empByUserID.userID) {
          const usr = await User.findById(empByUserID.userID);
          if (usr) {
            teamLeadUser = usr._id;
            if (!isTeamLeadRole(usr.role)) {
              usr.role = "team lead";
              await usr.save();
              console.log("✅ Updated linked user role to team lead by userID lookup");
            }
          }
        }
      }
    }

    if (!teamLeadUser && !teamLeadEmployee) {
      console.log("❌ No team lead found");
      return res.status(404).json({
        success: false,
        message: "Team Lead not found. Please provide a valid User or Employee ID",
      });
    }

    console.log(`👤 Team Lead: User=${teamLeadUser}, Employee=${teamLeadEmployee}`);

    // ===========================
    // STEP 2: Find existing team
    // ===========================
    
    let team = await Team.findOne({
      $or: [
        { teamLeadUser: teamLeadUser },
        { teamLeadEmployee: teamLeadEmployee },
      ],
    });

    // ===========================
    // STEP 3: Prepare team members
    // ===========================
    
    // IMPORTANT: 
    // - employees: array of Employee IDs (from Employee model)
    // - interns: array of User IDs (from User model)
    // - developers/designers/testers: legacy fields (User IDs)
    
    let employeeIds = [];
    let internIds = [];

    const normalizeEmployeeIds = async (ids = []) => {
      const uniqueIds = new Set();

      for (const item of ids) {
        const rawId = String(item || "").trim();
        if (!rawId) continue;

        const employee = await Employee.findById(rawId);
        if (employee) {
          uniqueIds.add(String(employee._id));
          continue;
        }

        const user = await User.findById(rawId);
        if (user) {
          const linkedEmployee = await Employee.findOne({ userID: user._id });
          if (linkedEmployee) {
            uniqueIds.add(String(linkedEmployee._id));
            continue;
          }

          const newEmployee = await Employee.create({
            userID: user._id,
            firstName: user.name?.split(" ")[0] || "User",
            lastName: user.name?.split(" ").slice(1).join(" ") || "",
            email: user.email,
            mobile: user.phone || "",
            department: user.department || null,
            designation: user.designation || (user.role === "team lead" ? "Team Lead" : "Employee"),
            isTeamLead: false,
          });

          uniqueIds.add(String(newEmployee._id));
          console.log(`✅ Created employee record for user ${user.name}`);
        }
      }

      return [...uniqueIds];
    };

    const normalizeInternIds = async (ids = []) => {
      const uniqueIds = new Set();

      for (const item of ids) {
        const rawId = String(item || "").trim();
        if (!rawId) continue;

        const user = await User.findById(rawId);
        if (user) {
          uniqueIds.add(String(user._id));
          user.role = user.role === "team lead" ? "team lead" : "intern";
          await user.save();
        }
      }

      return [...uniqueIds];
    };

    // Process employees (Employee model IDs)
    if (employees && employees.length > 0) {
      employeeIds = await normalizeEmployeeIds(employees);
    } else if (developers && developers.length > 0) {
      employeeIds = await normalizeEmployeeIds(developers);
    }

    // Process interns (User model IDs)
    if (interns && interns.length > 0) {
      internIds = await normalizeInternIds(interns);
    }

    for (const employeeId of employeeIds) {
      const employeeDoc = await Employee.findById(employeeId);
      if (employeeDoc) {
        employeeDoc.isTeamLead = false;
        await employeeDoc.save();

        if (employeeDoc.userID) {
          const employeeUser = await User.findById(employeeDoc.userID);
          if (employeeUser && employeeUser.role !== "team lead") {
            employeeUser.role = "employee";
            await employeeUser.save();
          }
        }
      }
    }

    if (teamLeadUser) {
      const leadUser = await User.findById(teamLeadUser);
      if (leadUser) {
        leadUser.role = "team lead";
        await leadUser.save();
      }
    }

    if (teamLeadEmployee) {
      const leadEmployee = await Employee.findById(teamLeadEmployee);
      if (leadEmployee) {
        leadEmployee.isTeamLead = true;
        await leadEmployee.save();
      }
    }

    // Ensure Team Lead unique ID is generated and stored
    const leadUserObj = teamLeadUser ? await User.findById(teamLeadUser) : null;
    const leadEmpObj = teamLeadEmployee ? await Employee.findById(teamLeadEmployee) : null;
    const teamLeadUniqueId = await ensureTeamLeadUniqueID({
      user: leadUserObj,
      employee: leadEmpObj,
      team,
    });

    console.log(`📊 Team Members: ${employeeIds.length} employees, ${internIds.length} interns, TL ID=${teamLeadUniqueId}`);

    // ===========================
    // STEP 4: Create or Update Team
    // ===========================

    if (team) {
      // Update existing team
      team.name = name || team.name || "";
      team.teamLeadId = teamLeadUniqueId || team.teamLeadId || "";
      team.teamLeadUser = teamLeadUser || team.teamLeadUser;
      team.teamLeadEmployee = teamLeadEmployee || team.teamLeadEmployee;
      team.employees = employeeIds;
      team.interns = internIds;
      
      // Update legacy fields if provided
      if (designers !== undefined) team.designers = designers;
      if (testers !== undefined) team.testers = testers;

      await team.save();
      console.log("✅ Team updated successfully:", team._id);

      // Populate for response
      const populatedTeam = await Team.findById(team._id)
        .populate('teamLeadUser', 'name email role uniqueID')
        .populate('teamLeadEmployee', 'firstName lastName email employeeID employeeCode')
        .populate('employees', 'firstName lastName email employeeID designation')
        .populate('interns', 'name email role uniqueID');

      return res.status(200).json({
        success: true,
        message: "Team Updated Successfully",
        data: populatedTeam,
      });
    }

    // Create new team
    const newTeam = await Team.create({
      name: name || "",
      teamLeadId: teamLeadUniqueId || "",
      teamLeadUser,
      teamLeadEmployee,
      employees: employeeIds,
      interns: internIds,
      designers: designers || [],
      testers: testers || [],
    });

    console.log("✅ Team created successfully:", newTeam._id);

    // Populate for response
    const populatedTeam = await Team.findById(newTeam._id)
      .populate('teamLeadUser', 'name email role uniqueID')
      .populate('teamLeadEmployee', 'firstName lastName email employeeID employeeCode')
      .populate('employees', 'firstName lastName email employeeID designation')
      .populate('interns', 'name email role uniqueID');

    return res.status(201).json({
      success: true,
      message: "Team Created Successfully",
      data: populatedTeam,
    });

  } catch (error) {
    console.error("❌ Error in createOrUpdateTeam:", error);
    
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
=========================
REMOVE / UNASSIGN TEAM LEAD
=========================
*/

/**
 * PUT /api/team-lead/remove-team-lead
 * Body: { teamLeadId } — User _id or Employee _id of the team lead to remove.
 *
 * 1. Reverts User.role → "employee"
 * 2. Reverts Employee.isTeamLead → false
 * 3. Clears teamLeadUser / teamLeadEmployee from the Team document they lead.
 *    (Team document is NOT deleted — the team remains but is now lead-less.)
 */
exports.removeTeamLead = async (req, res) => {
  try {
    const { teamLeadId } = req.body;

    if (!teamLeadId) {
      return res.status(400).json({
        success: false,
        message: "teamLeadId is required",
      });
    }
 
    // ─── Resolve the User and Employee records ────────────────────────
    let leadUser = await User.findById(teamLeadId);
    let leadEmployee = await Employee.findById(teamLeadId);

    // If the ID belongs to a User but no matching Employee was found by that ID,
    // look up the linked Employee record via userID.
    if (leadUser && !leadEmployee) {
      leadEmployee = await Employee.findOne({ userID: leadUser._id });
    }

    // If the ID belongs to an Employee but no matching User was found by that ID,
    // look up the linked User record via the Employee's userID field.
    if (!leadUser && leadEmployee && leadEmployee.userID) {
      leadUser = await User.findById(leadEmployee.userID);
    }

    // Also try resolving by Employee.userID if still unresolved.
    if (!leadUser && !leadEmployee) {
      const empByUserId = await Employee.findOne({ userID: teamLeadId });
      if (empByUserId) {
        leadEmployee = empByUserId;
        if (empByUserId.userID) {
          leadUser = await User.findById(empByUserId.userID);
        }
      }
    }

    if (!leadUser && !leadEmployee) {
      return res.status(404).json({
        success: false,
        message: "Team Lead not found. Please provide a valid User or Employee ID.",
      });
    }

    // Guard: only allow removing someone who is actually a team lead.
    const userIsTeamLead = leadUser && isTeamLeadRole(leadUser.role);
    const empIsTeamLead = leadEmployee && leadEmployee.isTeamLead;

    if (!userIsTeamLead && !empIsTeamLead) {
      return res.status(400).json({
        success: false,
        message: "The specified user is not currently assigned as a Team Lead.",
      });
    }

    // ─── 1. Revert User.role → "employee" ────────────────────────────
    if (leadUser && isTeamLeadRole(leadUser.role)) {
      leadUser.role = "employee";
      await leadUser.save();
      console.log(`✅ Reverted User ${leadUser._id} role to 'employee'`);
    }

    // ─── 2. Revert Employee.isTeamLead → false ───────────────────────
    if (leadEmployee && leadEmployee.isTeamLead) {
      leadEmployee.isTeamLead = false;
      // Clear Team Lead designation; fall back to generic 'Employee'
      if (
        leadEmployee.designation &&
        leadEmployee.designation.toLowerCase() === "team lead"
      ) {
        leadEmployee.designation = "Employee";
      }
      await leadEmployee.save();
      console.log(`✅ Reverted Employee ${leadEmployee._id} isTeamLead to false`);
    }

    // ─── 3. Delete the Team document(s) led by this team lead ────────
    // We delete the entire Team record rather than leaving it with null
    // teamLeadUser / teamLeadEmployee, which would create orphan documents.
    const teamQuery = [];
    if (leadUser) teamQuery.push({ teamLeadUser: leadUser._id });
    if (leadEmployee) teamQuery.push({ teamLeadEmployee: leadEmployee._id });

    const teamDeleteResult = await Team.deleteMany({ $or: teamQuery });
    console.log(
      `✅ Deleted ${teamDeleteResult.deletedCount} Team document(s) for removed team lead`
    );

    return res.status(200).json({
      success: true,
      message: "Team Lead removed successfully. Role reverted to employee.",
      data: {
        userId: leadUser?._id || null,
        employeeId: leadEmployee?._id || null,
        newRole: leadUser?.role || "employee",
        isTeamLead: leadEmployee?.isTeamLead || false,
        teamsDeleted: teamDeleteResult.deletedCount,
      },
    });
  } catch (error) {
    console.error("❌ Error in removeTeamLead:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
=========================
GET MY TEAM
=========================
*/

exports.getMyTeam = async (req, res) => {
  try {
    // Ensure all active Team Leads have a Team document
    const tlEmployees = await Employee.find({ isTeamLead: true });
    const tlUsers = await User.find({ role: { $in: ["teamlead", "team lead", "teamLead", "TeamLead"] } });

    // Create teams for employees marked as team lead
    for (const emp of tlEmployees) {
      let existingTeam = await Team.findOne({
        $or: [
          { teamLeadEmployee: emp._id },
          ...(emp.userID ? [{ teamLeadUser: emp.userID }] : [])
        ]
      });
      if (!existingTeam) {
        const leadName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
        const tlId = await ensureTeamLeadUniqueID({ employee: emp });
        await Team.create({
          name: leadName ? `${leadName} Team` : "New Team",
          teamLeadId: tlId,
          teamLeadEmployee: emp._id,
          teamLeadUser: emp.userID || null,
          employees: [],
          interns: [],
        });
      }
    }

    // Create teams for users with team lead role
    for (const usr of tlUsers) {
      if (usr.role?.toLowerCase() === "admin") continue;
      
      let existingTeam = await Team.findOne({
        $or: [
          { teamLeadUser: usr._id }
        ]
      });
      
      if (!existingTeam) {
        const linkedEmp = await Employee.findOne({ userID: usr._id });
        const tlId = await ensureTeamLeadUniqueID({ user: usr, employee: linkedEmp });
        await Team.create({
          name: `${usr.name || "Team Lead"} Team`,
          teamLeadId: tlId,
          teamLeadUser: usr._id,
          teamLeadEmployee: linkedEmp ? linkedEmp._id : null,
          employees: [],
          interns: [],
        });
      }
    }

    // Fetch all teams with populated data
    let teams = await Team.find()
      .populate({
        path: "teamLeadUser",
        select: "name email role uniqueID",
      })
      .populate({
        path: "teamLeadEmployee",
        select: "firstName lastName email mobile employeeID employeeCode designation department isTeamLead",
        populate: {
          path: "department",
          select: "name departmentName",
        },
      })
      .populate({
        path: "interns",
        select: "name email role uniqueID employeeID",
      })
      .populate({
        path: "employees",
        select: "firstName lastName email employeeID designation department",
        populate: {
          path: "department",
          select: "name departmentName",
        },
      });

    // If no teams exist, create one for the current user ONLY if they are NOT an admin
    if (!teams.length) {
      const currentUser = await User.findById(req.user._id);
      if (currentUser && currentUser.role?.toLowerCase() === "admin") {
        // Admin users should not get an auto-created team
        return res.status(200).json({
          success: true,
          total: 0,
          data: [],
        });
      }
      const newTeam = await createTeamForLead(req.user._id);
      teams = [newTeam];
    }

    // Process and format the data
    const data = await Promise.all(
      teams.map(async (team) => {
        const leadUser = team.teamLeadUser;
        const leadEmployee = team.teamLeadEmployee;

        const tlUniqueId = await ensureTeamLeadUniqueID({
          user: leadUser,
          employee: leadEmployee,
          team,
        });

        // Determine the correct role
        let role = "team lead";
        if (leadUser) {
          role = leadUser.role || "team lead";
        } else if (leadEmployee?.isTeamLead) {
          role = "team lead";
        }

        return {
          _id: team._id,
          name: team.name || "",
          teamLeadId: tlUniqueId || team.teamLeadId || "",
          teamLead: {
            userId: leadUser?._id || null,
            employeeId: leadEmployee?._id || null,
            name: leadUser?.name || 
                  `${leadEmployee?.firstName || ""} ${leadEmployee?.lastName || ""}`.trim() ||
                  "Unnamed",
            email: leadUser?.email || leadEmployee?.email || "",
            role: role,
            uniqueID: leadUser?.uniqueID || tlUniqueId || "",
            teamLeadId: tlUniqueId || team.teamLeadId || "",
            employeeID: leadEmployee?.employeeID || leadEmployee?.employeeCode || tlUniqueId || "",
            designation: leadEmployee?.designation || "",
            department: leadEmployee?.department || null,
          },
          interns: team.interns?.map((intern) => ({
            _id: intern._id,
            name: intern.name || "",
            email: intern.email || "",
            role: intern.role,
            uniqueID: intern.uniqueID,
            employeeID: intern.employeeID || "",
          })) || [],
          employees: team.employees?.map((emp) => ({
            _id: emp._id,
            name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Unnamed",
            email: emp.email || "",
            designation: emp.designation || "",
            employeeID: emp.employeeID || "",
          })) || [],
          totalInterns: team.interns?.length || 0,
          totalEmployees: team.employees?.length || 0,
          createdAt: team.createdAt,
        };
      })
    );

    // Filter out admin users
    const filteredData = data.filter((item) => {
      const role = item.teamLead?.role?.toLowerCase().trim() || "";
      return role !== "admin";
    });

    return res.status(200).json({
      success: true,
      total: filteredData.length,
      data: filteredData
    });

  } catch (error) {
    console.error("Error in getMyTeam:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/*
=========================
GET REPORTS
=========================
*/

exports.getReports =
  async (req, res) => {
    try {
      const teamIds =
        await getTeamIds(
          req.user._id
        );

      if (
        !teamIds
      ) {
        return res
          .status(404)
          .json({
            success:
              false,
            message:
              "No team found",
          });
      }

      const reports =
        await DailyReport.find(
          {
            userId: {
              $in:
                teamIds,
            },
          }
        )
          .populate(
            "userId",
            "name email"
          )
          .sort({
            createdAt:
              -1,
          });

      return res
        .status(200)
        .json({
          success:
            true,
          data:
            reports,
        });
    } catch (
      error
    ) {
      return res
        .status(500)
        .json({
          success:
            false,
          message:
            error.message,
        });
    }
  };