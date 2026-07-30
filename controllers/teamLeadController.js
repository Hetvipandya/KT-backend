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

    console.log("📝 Creating/Updating Team:", { 
      teamLead, 
      employeesCount: employees.length, 
      internsCount: interns.length 
    });

    if (!teamLead) {
      return res.status(400).json({
        success: false,
        message: "Team Lead is required",
      });
    }

    // ===========================
    // STEP 1: Find and Set Up Team Lead
    // ===========================
    
    let teamLeadUser = null;
    let teamLeadEmployee = null;
    
    // Try to find as User first
    const user = await User.findById(teamLead);
    const employee = await Employee.findById(teamLead);
    
    // Helper function to ensure user role is team lead
    const ensureTeamLeadRole = async (userDoc) => {
      if (userDoc && !isTeamLeadRole(userDoc.role)) {
        userDoc.role = "team lead";
        await userDoc.save();
        console.log(`✅ Updated user ${userDoc.email} role to team lead`);
        return true;
      }
      return false;
    };

    // Case 1: teamLead is a User ID
    if (user) {
      teamLeadUser = user._id;
      await ensureTeamLeadRole(user);
      
      // Find or create Employee record
      let emp = await Employee.findOne({ userID: user._id });
      if (!emp) {
        emp = await Employee.create({
          userID: user._id,
          firstName: user.name?.split(' ')[0] || 'Team',
          lastName: user.name?.split(' ').slice(1).join(' ') || 'Lead',
          email: user.email,
          isTeamLead: true,
          role: "team lead",
          department: user.department || null,
          mobile: user.phoneNumber || "",
          currentAddress: user.address || "",
          permanentAddress: user.address || "",
          designation: "Team Lead",
        });
        console.log("✅ Created employee record for team lead user");
      } else if (!emp.isTeamLead) {
        emp.isTeamLead = true;
        emp.role = "team lead";
        await emp.save();
        console.log("✅ Updated employee to be team lead");
      }
      teamLeadEmployee = emp._id;
    }
    
    // Case 2: teamLead is an Employee ID
    else if (employee) {
      teamLeadEmployee = employee._id;
      
      if (!employee.isTeamLead) {
        employee.isTeamLead = true;
        employee.role = "team lead";
        await employee.save();
        console.log("✅ Marked employee as team lead");
      }
      
      // Find associated User and update role
      if (employee.userID) {
        const usr = await User.findById(employee.userID);
        if (usr) {
          teamLeadUser = usr._id;
          await ensureTeamLeadRole(usr);
        }
      }
    }
    
    // Case 3: teamLead is a User ID but User not found, check Employee with that userID
    else {
      const empByUserID = await Employee.findOne({ userID: teamLead });
      if (empByUserID) {
        teamLeadEmployee = empByUserID._id;
        
        if (!empByUserID.isTeamLead) {
          empByUserID.isTeamLead = true;
          empByUserID.role = "team lead";
          await empByUserID.save();
          console.log("✅ Marked employee as team lead by userID lookup");
        }
        
        if (empByUserID.userID) {
          const usr = await User.findById(empByUserID.userID);
          if (usr) {
            teamLeadUser = usr._id;
            await ensureTeamLeadRole(usr);
          }
        }
      }
    }

    // Final validation
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
        ...(teamLeadUser ? [{ teamLeadUser: teamLeadUser }] : []),
        ...(teamLeadEmployee ? [{ teamLeadEmployee: teamLeadEmployee }] : [])
      ]
    });

    // ===========================
    // STEP 3: Validate and Process Members
    // ===========================
    
    // Remove duplicates and validate IDs
    const validateIds = async (ids, model, fieldName) => {
      if (!ids || ids.length === 0) return [];
      
      const validIds = [];
      const invalidIds = [];
      
      for (const id of ids) {
        const exists = await model.findById(id);
        if (exists) {
          validIds.push(String(id));
        } else {
          invalidIds.push(id);
        }
      }
      
      if (invalidIds.length > 0) {
        console.warn(`⚠️ Invalid ${fieldName} IDs:`, invalidIds);
      }
      
      return validIds;
    };

    // Process employees (Employee model IDs)
    let employeeIds = await validateIds(employees, Employee, 'employee');
    
    // Backward compatibility: process developers (User IDs)
    if (developers && developers.length > 0) {
      for (const userId of developers) {
        let emp = await Employee.findOne({ userID: userId });
        if (!emp) {
          const usr = await User.findById(userId);
          if (usr) {
            // Ensure user role is not team lead (they're developers)
            if (isTeamLeadRole(usr.role)) {
              usr.role = "developer";
              await usr.save();
              console.log(`✅ Updated user ${usr.email} role to developer`);
            }
            
            emp = await Employee.create({
              userID: usr._id,
              firstName: usr.name?.split(' ')[0] || 'User',
              lastName: usr.name?.split(' ').slice(1).join(' ') || '',
              email: usr.email,
              role: 'developer',
              designation: 'Developer'
            });
            console.log(`✅ Created employee record for developer ${usr.name}`);
          }
        }
        if (emp) {
          employeeIds.push(String(emp._id));
        }
      }
    }
    
    // Process interns (User model IDs) - ensure they have intern role
    let internIds = [];
    if (interns && interns.length > 0) {
      for (const userId of interns) {
        const internUser = await User.findById(userId);
        if (internUser) {
          // Ensure intern role
          if (internUser.role !== 'intern') {
            internUser.role = 'intern';
            await internUser.save();
            console.log(`✅ Updated user ${internUser.email} role to intern`);
          }
          internIds.push(String(userId));
        }
      }
    }

    // Remove duplicates
    employeeIds = [...new Set(employeeIds)];
    internIds = [...new Set(internIds)];

    console.log(`📊 Team Members: ${employeeIds.length} employees, ${internIds.length} interns`);

    // ===========================
    // STEP 4: Create or Update Team
    // ===========================

    if (team) {
      // Update existing team
      team.name = name || team.name || "";
      if (teamLeadUser) team.teamLeadUser = teamLeadUser;
      if (teamLeadEmployee) team.teamLeadEmployee = teamLeadEmployee;
      team.employees = employeeIds;
      team.interns = internIds;
      
      // Update legacy fields if provided
      if (designers !== undefined) team.designers = designers;
      if (testers !== undefined) team.testers = testers;

      await team.save();
      console.log("✅ Team updated successfully:", team._id);

      // Populate for response
      const populatedTeam = await Team.findById(team._id)
        .populate('teamLeadUser', 'name email role')
        .populate('teamLeadEmployee', 'firstName lastName email employeeID')
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
      .populate('teamLeadUser', 'name email role')
      .populate('teamLeadEmployee', 'firstName lastName email employeeID')
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
GET MY TEAM
=========================
*/

const resolveTeamLeadUserForResponse = async (team) => {
  const populatedUser = team.teamLeadUser;

  if (populatedUser && isTeamLeadRole(populatedUser.role)) {
    return populatedUser;
  }

  const employee = team.teamLeadEmployee;

  if (employee?.userID) {
    const linkedUser = await User.findById(employee.userID);
    if (linkedUser && isTeamLeadRole(linkedUser.role)) {
      return linkedUser;
    }
  }

  return populatedUser || null;
};

exports.getMyTeam = async (req, res) => {
  try {
    let teams = await Team.find()
      .populate({
        path: "teamLeadUser",
        select: "name email role uniqueID",
      })
      .populate({
        path: "teamLeadEmployee",
        select:
          "firstName lastName email mobile employeeID designation department",
        populate: {
          path: "department",
          select: "name",
        },
      })
      .populate({
        path: "interns",
        select:
          "name email role uniqueID employeeID",
      });

    // Also populate assigned employees
    await Team.populate(teams, {
      path: "employees",
      select: "firstName lastName email employeeID designation department",
      populate: {
        path: "department",
        select: "name",
      },
    });

    if (!teams.length) {
      const newTeam = await createTeamForLead(req.user._id);
      teams = [newTeam];
    }

    const data = [];

    for (const team of teams) {
      const leadUser = await resolveTeamLeadUserForResponse(team);
      const leadEmployee = team.teamLeadEmployee;

      data.push({

        _id: team._id,

        name: team.name || "",

        teamLead: {

          userId: leadUser?._id || null,

          employeeId:
            leadEmployee?._id || null,


          name:
            leadUser?.name ||
            `${leadEmployee?.firstName || ""} ${
              leadEmployee?.lastName || ""
            }`,


          email:
            leadUser?.email ||
            leadEmployee?.email ||
            "",


          role:
            leadUser?.role ||
            "team lead",


          uniqueID:
            leadUser?.uniqueID || "",


          employeeID:
            leadEmployee?.employeeID || "",


          designation:
            leadEmployee?.designation || "",


          department:
            leadEmployee?.department || null,
        },


        interns: team.interns?.map((intern)=>({

          _id: intern._id,

          name:
            intern.name || "",

          email:
            intern.email || "",

          role:
            intern.role,

          uniqueID:
            intern.uniqueID,

          employeeID:
            intern.employeeID || "",

        })) || [],

        employees: team.employees?.map((emp) => ({
          _id: emp._id,
          name:
            emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
          email: emp.email || "",
          designation: emp.designation || "",
          employeeID: emp.employeeID || "",
        })) || [],


        totalInterns:
          team.interns?.length || 0,

        totalEmployees:
          team.employees?.length || 0,


        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      });
    }



    return res.status(200).json({

      success:true,

      total:data.length,

      data

    });


  } catch(error){

    return res.status(500).json({

      success:false,

      message:error.message

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