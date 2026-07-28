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
      employees = [],
      interns = [],
      developers = [],
      designers = [],
      testers = [],
    } = req.body;

    if (!teamLead) {
      return res.status(400).json({
        success: false,
        message: "Team Lead is required",
      });
    }

    let teamLeadUser = null;
    let teamLeadEmployee = null;
    let team = null;

    // ===========================
    // STEP 1: Find the user and employee
    // ===========================
    
    // Try to find as User first
    const user = await User.findById(teamLead);
    
    // Try to find as Employee
    const employee = await Employee.findById(teamLead);
    
    // If not found by ID directly, try to find by userID (if teamLead is a user ID)
    let linkedEmployee = null;
    if (user) {
      linkedEmployee = await Employee.findOne({ userID: user._id });
    }
    
    // If not found by user, try to find employee with this userID
    let linkedUser = null;
    if (employee && employee.userID) {
      linkedUser = await User.findById(employee.userID);
    }

    // ===========================
    // STEP 2: Determine team lead user reference
    // ===========================
    
    // Check if the provided ID is a User with team lead role
    if (user) {
      // Check if user has role "team lead" or "teamlead"
      if (user.role === "team lead" || user.role === "teamlead") {
        teamLeadUser = user._id;
      }
    }
    
    // If user wasn't found or doesn't have team lead role, check employee
    if (!teamLeadUser && employee) {
      // Check if employee is marked as team lead
      if (employee.isTeamLead === true) {
        teamLeadEmployee = employee._id;
        // Also try to find associated user
        if (employee.userID) {
          const assocUser = await User.findById(employee.userID);
          if (assocUser) {
            teamLeadUser = assocUser._id;
          }
        }
      }
    }
    
    // If still no team lead, check if the provided ID is actually a user ID 
    // and there's an employee linked to it with isTeamLead: true
    if (!teamLeadUser && !teamLeadEmployee && user) {
      if (linkedEmployee && linkedEmployee.isTeamLead === true) {
        teamLeadUser = user._id;
        teamLeadEmployee = linkedEmployee._id;
      }
    }
    
    // If still no team lead, check if the provided ID is an employee ID
    // with isTeamLead: true but we might have missed it
    if (!teamLeadUser && !teamLeadEmployee) {
      // Try to find employee directly with this ID and isTeamLead: true
      const directEmployee = await Employee.findOne({
        _id: teamLead,
        isTeamLead: true
      });
      
      if (directEmployee) {
        teamLeadEmployee = directEmployee._id;
        if (directEmployee.userID) {
          const assocUser = await User.findById(directEmployee.userID);
          if (assocUser) {
            teamLeadUser = assocUser._id;
          }
        }
      }
    }
    
    // If still no team lead, try to find any employee with isTeamLead: true
    // and userID matching the provided ID
    if (!teamLeadUser && !teamLeadEmployee) {
      const employeeByUserID = await Employee.findOne({
        userID: teamLead,
        isTeamLead: true
      });
      
      if (employeeByUserID) {
        teamLeadEmployee = employeeByUserID._id;
        if (employeeByUserID.userID) {
          const assocUser = await User.findById(employeeByUserID.userID);
          if (assocUser) {
            teamLeadUser = assocUser._id;
          }
        }
      }
    }

    // If we have a user but no employee, and the user has team lead role,
    // try to find or create an employee record for them
    if (teamLeadUser && !teamLeadEmployee) {
      // Check if user already has an employee record
      const existingEmployee = await Employee.findOne({ userID: teamLeadUser });
      
      if (existingEmployee) {
        // Update the existing employee to be team lead
        existingEmployee.isTeamLead = true;
        await existingEmployee.save();
        teamLeadEmployee = existingEmployee._id;
      } else {
        // Create a new employee record for this user
        const newEmployee = await Employee.create({
          userID: teamLeadUser,
          firstName: user.name ? user.name.split(' ')[0] : 'Team',
          lastName: user.name ? user.name.split(' ').slice(1).join(' ') : 'Lead',
          email: user.email,
          isTeamLead: true,
          role: "team lead"
        });
        teamLeadEmployee = newEmployee._id;
      }
    }

    // ===========================
    // STEP 3: Find existing team
    // ===========================
    
    if (teamLeadUser || teamLeadEmployee) {
      team = await Team.findOne({
        $or: [
          { teamLeadUser: teamLeadUser },
          { teamLeadEmployee: teamLeadEmployee },
        ],
      });
    }

    // If still no team lead found, return error
    if (!teamLeadUser && !teamLeadEmployee) {
      return res.status(404).json({
        success: false,
        message: "Team Lead not found or not marked as team lead. Please ensure the user has role 'team lead' or employee has isTeamLead: true",
      });
    }

    // ===========================
    // STEP 4: Create or Update Team
    // ===========================

    if (team) {
      // Clear existing arrays and set new ones
      if (employees && employees.length > 0) {
        team.employees = employees;
      } else if (developers && developers.length > 0) {
        team.employees = developers;
      } else if (req.body.employees !== undefined && req.body.employees.length === 0) {
        team.employees = [];
      }

      if (interns !== undefined) {
        team.interns = interns;
      }

      if (designers !== undefined) {
        team.designers = designers;
      }

      if (testers !== undefined) {
        team.testers = testers;
      }

      // Ensure teamLead fields are set
      if (teamLeadUser) team.teamLeadUser = teamLeadUser;
      if (teamLeadEmployee) team.teamLeadEmployee = teamLeadEmployee;

      await team.save();

      return res.status(200).json({
        success: true,
        message: "Team Updated Successfully",
        data: team,
      });
    }

    // Create new team
    const newTeam = await Team.create({
      teamLeadUser,
      teamLeadEmployee,
      employees: employees && employees.length > 0 ? employees : developers || [],
      interns: interns || [],
      designers: designers || [],
      testers: testers || [],
    });

    return res.status(201).json({
      success: true,
      message: "Team Created Successfully",
      data: newTeam,
    });

  } catch (error) {
    console.log("Error in createOrUpdateTeam:", error);
    
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

    const teams = await Team.find()
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


    const data = teams.map((team) => {

      const leadUser = team.teamLeadUser;

      const leadEmployee = team.teamLeadEmployee;


      return {

        _id: team._id,


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

      };

    });



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