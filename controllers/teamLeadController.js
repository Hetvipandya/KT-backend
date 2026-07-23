// const mongoose =
//   require("mongoose");

// const Attendance =
//   require("../models/Attendance");

// const DailyReport = 
//   require("../models/DailyReport");
 
// const Task =
//   require("../models/taskModel");

// const User =
//   require("../models/User");

//   const Employee = require("../models/Employee");

// const Team =
//   require("../models/Team");

// /*
// =========================
// COMMON TEAM IDS
// =========================
// */

// const getTeamIds = async (teamLeadId) => {
//   console.log("Logged In Team Lead ID:", teamLeadId);

//   // Find team either by linked User or Employee lead reference
//   const team =
//     (await Team.findOne({ teamLeadUser: new mongoose.Types.ObjectId(teamLeadId) })) ||
//     (await Team.findOne({ teamLeadEmployee: new mongoose.Types.ObjectId(teamLeadId) }));

//   console.log("Team Found:", team);

//   if (!team) return null;

//   // Collect member ids from known arrays. Support both legacy fields
//   // (developers/designers/testers) and current fields (employees/interns).
//   const members = [];

//   if (team.employees && team.employees.length) {
//     members.push(...team.employees);
//   }

//   if (team.interns && team.interns.length) {
//     members.push(...team.interns);
//   }

//   if (team.developers && team.developers.length) {
//     members.push(...team.developers);
//   }

//   if (team.designers && team.designers.length) {
//     members.push(...team.designers);
//   }

//   if (team.testers && team.testers.length) {
//     members.push(...team.testers);
//   }

//   return members;
// };

// /*
// =========================
// DASHBOARD
// =========================
// */

// exports.getDashboard =
//   async (req, res) => {
//     try {
//       const tlId =
//         req.user._id;

//       const teamIds =
//         await getTeamIds(
//           tlId
//         );

//       if (
//         !teamIds
//       ) {
//         return res
//           .status(404)
//           .json({
//             success:
//               false,
//             message:
//               "No team found for this TL",
//           });
//       }

//       const totalTeam =
//         teamIds.length;

//       const today =
//         new Date();
//       today.setHours(
//         0,
//         0,
//         0,
//         0
//       );

//       const todayAttendance =
//         await Attendance.countDocuments(
//           {
//             userId: {
//               $in:
//                 teamIds,
//             },
//             createdAt: {
//               $gte:
//                 today,
//             },
//           }
//         );

//       const absentEmployees =
//         totalTeam -
//         todayAttendance;

//       const pendingReports =
//         await DailyReport.countDocuments(
//           {
//             userId: {
//               $in:
//                 teamIds,
//             },
//             status:
//               "pending",
//           }
//         );

//       const pendingTasks =
//         await Task.countDocuments(
//           {
//             assignedBy:
//               tlId,
//             status:
//               "pending",
//           }
//         );

//       const delayedTasks =
//         await Task.countDocuments(
//           {
//             assignedBy:
//               tlId,
//             dueDate: {
//               $lt:
//                 new Date(),
//             },
//             status: {
//               $ne:
//                 "completed",
//             },
//           }
//         );

//       return res
//         .status(200)
//         .json({
//           success:
//             true,
//           data: {
//             totalTeam,
//             todayAttendance,
//             absentEmployees,
//             pendingReports,
//             pendingTasks,
//             projectProgress:
//               "In Progress",
//             riskAlerts:
//               delayedTasks,
//             delayedTasks,
//           },
//         });
//     } catch (
//       error
//     ) {
//       console.log(
//         error
//       );

//       return res
//         .status(500)
//         .json({
//           success:
//             false,
//           message:
//             error.message,
//         });
//     }
//   };

// exports.createOrUpdateTeam = async (req, res) => {
//   try {
//     const {
//       teamLead,
//       employees = [],
//       interns = [],
//       developers = [],
//       designers = [],
//       testers = [],
//     } = req.body;

//     if (!teamLead) {
//       return res.status(400).json({
//         success: false,
//         message: "Team Lead is required",
//       });
//     }

//     let teamLeadUser = null;
//     let teamLeadEmployee = null;
//     let team = null;

//     // ===========================
//     // CHECK USER COLLECTION
//     // ===========================

//     const user = await User.findById(teamLead);

//     if (user) {
//       teamLeadUser = user._id;

//       // Check by user id
//       team = await Team.findOne({
//         teamLeadUser: teamLeadUser,
//       });
//     }

//     // ===========================
//     // CHECK EMPLOYEE COLLECTION
//     // ===========================

//     if (!user) {
//       const employee = await Employee.findById(teamLead);

//       if (employee && employee.isTeamLead) {
//         teamLeadEmployee = employee._id;

//         // Check by employee id
//         team = await Team.findOne({
//           teamLeadEmployee: teamLeadEmployee,
//         });
//       }
//     }

//     if (!teamLeadUser && !teamLeadEmployee) {
//       return res.status(404).json({
//         success: false,
//         message: "Team Lead not found",
//       });
//     }

//     // ===========================
//     // UPDATE EXISTING TEAM
//     // ===========================

//     if (team) {
//       // Clear existing arrays and set new ones
//       // IMPORTANT: Use the fields that your frontend is sending
      
//       // Update employees if provided
//       if (employees && employees.length > 0) {
//         team.employees = employees;
//       } else if (developers && developers.length > 0) {
//         // For backward compatibility
//         team.employees = developers;
//       } else if (req.body.employees !== undefined && req.body.employees.length === 0) {
//         // Allow clearing employees array
//         team.employees = [];
//       }

//       // Update interns if provided
//       if (interns !== undefined) {
//         team.interns = interns;
//       }

//       // Update designers if provided
//       if (designers !== undefined) {
//         team.designers = designers;
//       }

//       // Update testers if provided
//       if (testers !== undefined) {
//         team.testers = testers;
//       }

//       await team.save();

//       return res.status(200).json({
//         success: true,
//         message: "Team Updated Successfully",
//         data: team,
//       });
//     }

//     // ===========================
//     // CREATE NEW TEAM
//     // ===========================

//     const newTeam = await Team.create({
//       teamLeadUser,
//       teamLeadEmployee,
//       employees: employees && employees.length > 0 ? employees : developers || [],
//       interns: interns || [],
//       designers: designers || [],
//       testers: testers || [],
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Team Created Successfully",
//       data: newTeam,
//     });

//   } catch (error) {
//     console.log(error);

//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// /*
// =========================
// GET MY TEAM
// =========================
// */

// exports.getMyTeam = async (req, res) => {
//   try {

//     const teams = await Team.find()
//       .populate({
//         path: "teamLeadUser",
//         select: "name email role uniqueID",
//       })
//       .populate({
//         path: "teamLeadEmployee",
//         select:
//           "firstName lastName email mobile employeeID designation department",
//         populate: {
//           path: "department",
//           select: "name",
//         },
//       })
//       .populate({
//         path: "interns",
//         select:
//           "name email role uniqueID employeeID",
//       });

//     // Also populate assigned employees
//     await Team.populate(teams, {
//       path: "employees",
//       select: "firstName lastName email employeeID designation department",
//       populate: {
//         path: "department",
//         select: "name",
//       },
//     });


//     const data = teams.map((team) => {

//       const leadUser = team.teamLeadUser;

//       const leadEmployee = team.teamLeadEmployee;


//       return {

//         _id: team._id,


//         teamLead: {

//           userId: leadUser?._id || null,

//           employeeId:
//             leadEmployee?._id || null,


//           name:
//             leadUser?.name ||
//             `${leadEmployee?.firstName || ""} ${
//               leadEmployee?.lastName || ""
//             }`,


//           email:
//             leadUser?.email ||
//             leadEmployee?.email ||
//             "",


//           role:
//             leadUser?.role ||
//             "team lead",


//           uniqueID:
//             leadUser?.uniqueID || "",


//           employeeID:
//             leadEmployee?.employeeID || "",


//           designation:
//             leadEmployee?.designation || "",


//           department:
//             leadEmployee?.department || null,
//         },


//         interns: team.interns?.map((intern)=>({

//           _id: intern._id,

//           name:
//             intern.name || "",

//           email:
//             intern.email || "",

//           role:
//             intern.role,

//           uniqueID:
//             intern.uniqueID,

//           employeeID:
//             intern.employeeID || "",

//         })) || [],

//         employees: team.employees?.map((emp) => ({
//           _id: emp._id,
//           name:
//             emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
//           email: emp.email || "",
//           designation: emp.designation || "",
//           employeeID: emp.employeeID || "",
//         })) || [],


//         totalInterns:
//           team.interns?.length || 0,

//         totalEmployees:
//           team.employees?.length || 0,


//         createdAt: team.createdAt,
//         updatedAt: team.updatedAt,

//       };

//     });



//     return res.status(200).json({

//       success:true,

//       total:data.length,

//       data

//     });


//   } catch(error){

//     return res.status(500).json({

//       success:false,

//       message:error.message

//     });

//   }
// };

// /*
// =========================
// GET REPORTS
// =========================
// */

// exports.getReports =
//   async (req, res) => {
//     try {
//       const teamIds =
//         await getTeamIds(
//           req.user._id
//         );

//       if (
//         !teamIds
//       ) {
//         return res
//           .status(404)
//           .json({
//             success:
//               false,
//             message:
//               "No team found",
//           });
//       }

//       const reports =
//         await DailyReport.find(
//           {
//             userId: {
//               $in:
//                 teamIds,
//             },
//           }
//         )
//           .populate(
//             "userId",
//             "name email"
//           )
//           .sort({
//             createdAt:
//               -1,
//           });

//       return res
//         .status(200)
//         .json({
//           success:
//             true,
//           data:
//             reports,
//         });
//     } catch (
//       error
//     ) {
//       return res
//         .status(500)
//         .json({
//           success:
//             false,
//           message:
//             error.message,
//         });
//     }
//   };

// controllers/teamLeadController.js
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const DailyReport = require("../models/DailyReport");
const Task = require("../models/taskModel");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");

/*
=========================
HELPER FUNCTIONS
=========================
*/

// Helper to validate MongoDB ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Helper to process array of IDs (handles both strings and objects)
const processIds = (items) => {
  if (!items || !Array.isArray(items)) return [];
  
  return items
    .map(item => {
      if (typeof item === 'string') {
        return isValidObjectId(item) ? item : null;
      }
      if (typeof item === 'object' && item !== null) {
        const id = item._id || item.id || item.userId || item.employeeId || null;
        return id && isValidObjectId(id) ? id : null;
      }
      return null;
    })
    .filter(Boolean);
};

// Helper to get unique IDs
const getUniqueIds = (ids) => {
  return [...new Set(ids)];
};

/*
=========================
COMMON TEAM IDS
=========================
*/

const getTeamIds = async (teamLeadId) => {
  console.log("Logged In Team Lead ID:", teamLeadId);

  // Find team either by linked User or Employee lead reference
  const team =
    (await Team.findOne({ teamLeadUser: new mongoose.Types.ObjectId(teamLeadId) })) ||
    (await Team.findOne({ teamLeadEmployee: new mongoose.Types.ObjectId(teamLeadId) }));

  console.log("Team Found:", team);

  if (!team) return null;

  // Collect member ids from employees and interns arrays
  const members = [];

  if (team.employees && team.employees.length) {
    members.push(...team.employees);
  }

  if (team.interns && team.interns.length) {
    members.push(...team.interns);
  }

  return members;
};

/*
=========================
DASHBOARD
=========================
*/

exports.getDashboard = async (req, res) => {
  try {
    const tlId = req.user._id;
    const teamIds = await getTeamIds(tlId);

    if (!teamIds) {
      return res.status(404).json({
        success: false,
        message: "No team found for this TL",
      });
    }

    const totalTeam = teamIds.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAttendance = await Attendance.countDocuments({
      userId: { $in: teamIds },
      createdAt: { $gte: today },
    });

    const absentEmployees = totalTeam - todayAttendance;

    const pendingReports = await DailyReport.countDocuments({
      userId: { $in: teamIds },
      status: "pending",
    });

    const pendingTasks = await Task.countDocuments({
      assignedBy: tlId,
      status: "pending",
    });

    const delayedTasks = await Task.countDocuments({
      assignedBy: tlId,
      dueDate: { $lt: new Date() },
      status: { $ne: "completed" },
    });

    return res.status(200).json({
      success: true,
      data: {
        totalTeam,
        todayAttendance,
        absentEmployees,
        pendingReports,
        pendingTasks,
        projectProgress: "In Progress",
        riskAlerts: delayedTasks,
        delayedTasks,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
=========================
CREATE OR UPDATE TEAM
=========================
*/

exports.createOrUpdateTeam = async (req, res) => {
  try {
    const {
      teamLead,
      employees = [],
      interns = [],
    } = req.body;

    console.log("Create/Update Team Request:", { teamLead, employees, interns });

    if (!teamLead) {
      return res.status(400).json({
        success: false,
        message: "Team Lead ID is required",
      });
    }

    // Process and validate IDs
    const employeeIds = processIds(employees);
    const internIds = processIds(interns);

    let teamLeadUser = null;
    let teamLeadEmployee = null;
    let team = null;
    let leadFound = false;

    // ===========================
    // FIND TEAM LEAD IN USER COLLECTION
    // ===========================

    const user = await User.findById(teamLead);
    if (user) {
      teamLeadUser = user._id;
      team = await Team.findOne({ teamLeadUser: teamLeadUser });
      leadFound = true;
      console.log("Found team lead in User collection:", user._id);
    }

    // ===========================
    // FIND TEAM LEAD IN EMPLOYEE COLLECTION
    // ===========================

    if (!leadFound) {
      const employee = await Employee.findById(teamLead);
      if (employee) {
        teamLeadEmployee = employee._id;
        team = await Team.findOne({ teamLeadEmployee: teamLeadEmployee });
        leadFound = true;
        console.log("Found team lead in Employee collection:", employee._id);
      }
    }

    if (!leadFound) {
      return res.status(404).json({
        success: false,
        message: "Team Lead not found in User or Employee collection",
      });
    }

    // ===========================
    // VALIDATE EMPLOYEES EXIST
    // ===========================

    if (employeeIds.length > 0) {
      const existingEmployees = await Employee.find({
        _id: { $in: employeeIds }
      });
      
      if (existingEmployees.length !== employeeIds.length) {
        const foundIds = existingEmployees.map(e => e._id.toString());
        const missingIds = employeeIds.filter(id => !foundIds.includes(id.toString()));
        return res.status(400).json({
          success: false,
          message: `Some employees not found: ${missingIds.join(', ')}`,
        });
      }
    }

    // ===========================
    // VALIDATE INTERNS EXIST (Users with role 'intern')
    // ===========================

    if (internIds.length > 0) {
      const existingInterns = await User.find({
        _id: { $in: internIds },
        role: { $regex: /intern/i }
      });
      
      if (existingInterns.length !== internIds.length) {
        const foundIds = existingInterns.map(e => e._id.toString());
        const missingIds = internIds.filter(id => !foundIds.includes(id.toString()));
        return res.status(400).json({
          success: false,
          message: `Some interns not found or not valid interns: ${missingIds.join(', ')}`,
        });
      }
    }

    // ===========================
    // UPDATE EXISTING TEAM
    // ===========================

    if (team) {
      console.log("Updating existing team:", team._id);

      // Update employees if provided
      if (employees !== undefined && Array.isArray(employees)) {
        if (employees.length === 0) {
          team.employees = [];
        } else {
          team.employees = getUniqueIds(employeeIds);
        }
      }

      // Update interns if provided
      if (interns !== undefined && Array.isArray(interns)) {
        if (interns.length === 0) {
          team.interns = [];
        } else {
          team.interns = getUniqueIds(internIds);
        }
      }

      await team.save();

      // Populate the response
      const populatedTeam = await Team.findById(team._id)
        .populate({
          path: "teamLeadUser",
          select: "name email role uniqueID",
        })
        .populate({
          path: "teamLeadEmployee",
          select: "firstName lastName email employeeID designation",
        })
        .populate({
          path: "employees",
          select: "firstName lastName email employeeID designation",
        })
        .populate({
          path: "interns",
          select: "name email role uniqueID",
        });

      return res.status(200).json({
        success: true,
        message: "Team updated successfully",
        data: populatedTeam,
      });
    }

    // ===========================
    // CREATE NEW TEAM
    // ===========================

    console.log("Creating new team");

    const newTeam = await Team.create({
      teamLeadUser: teamLeadUser || null,
      teamLeadEmployee: teamLeadEmployee || null,
      employees: getUniqueIds(employeeIds),
      interns: getUniqueIds(internIds),
    });

    // Populate the response
    const populatedNewTeam = await Team.findById(newTeam._id)
      .populate({
        path: "teamLeadUser",
        select: "name email role uniqueID",
      })
      .populate({
        path: "teamLeadEmployee",
        select: "firstName lastName email employeeID designation",
      })
      .populate({
        path: "employees",
        select: "firstName lastName email employeeID designation",
      })
      .populate({
        path: "interns",
        select: "name email role uniqueID",
      });

    return res.status(201).json({
      success: true,
      message: "Team created successfully",
      data: populatedNewTeam,
    });

  } catch (error) {
    console.error("Create/Update Team Error:", error);
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
        select: "firstName lastName email mobile employeeID designation department",
        populate: {
          path: "department",
          select: "name",
        },
      })
      .populate({
        path: "employees",
        select: "firstName lastName email employeeID designation department",
        populate: {
          path: "department",
          select: "name",
        },
      })
      .populate({
        path: "interns",
        select: "name email role uniqueID employeeID",
      });

    const data = teams.map((team) => {
      const leadUser = team.teamLeadUser;
      const leadEmployee = team.teamLeadEmployee;

      return {
        _id: team._id,
        teamLead: {
          userId: leadUser?._id || null,
          employeeId: leadEmployee?._id || null,
          name: leadUser?.name || 
                `${leadEmployee?.firstName || ""} ${leadEmployee?.lastName || ""}`.trim() || 
                "Team Lead",
          email: leadUser?.email || leadEmployee?.email || "",
          role: leadUser?.role || "team lead",
          uniqueID: leadUser?.uniqueID || "",
          employeeID: leadEmployee?.employeeID || "",
          designation: leadEmployee?.designation || "",
          department: leadEmployee?.department || null,
        },
        employees: team.employees?.map((emp) => ({
          _id: emp._id,
          name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Unknown",
          email: emp.email || "",
          employeeID: emp.employeeID || "",
          designation: emp.designation || "",
          department: emp.department || null,
        })) || [],
        interns: team.interns?.map((intern) => ({
          _id: intern._id,
          name: intern.name || "",
          email: intern.email || "",
          role: intern.role || "intern",
          uniqueID: intern.uniqueID || "",
          employeeID: intern.employeeID || "",
        })) || [],
        totalEmployees: team.employees?.length || 0,
        totalInterns: team.interns?.length || 0,
        totalMembers: (team.employees?.length || 0) + (team.interns?.length || 0),
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
    });

  } catch (error) {
    console.error("Get My Team Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
=========================
GET REPORTS
=========================
*/

exports.getReports = async (req, res) => {
  try {
    const teamIds = await getTeamIds(req.user._id);

    if (!teamIds) {
      return res.status(404).json({
        success: false,
        message: "No team found",
      });
    }

    const reports = await DailyReport.find({
      userId: { $in: teamIds },
    })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
=========================
GET TEAM BY TEAM LEAD ID
=========================
*/

exports.getTeamByTeamLead = async (req, res) => {
  try {
    const { teamLeadId } = req.params;

    if (!teamLeadId) {
      return res.status(400).json({
        success: false,
        message: "Team Lead ID is required",
      });
    }

    const team = await Team.findOne({
      $or: [
        { teamLeadUser: teamLeadId },
        { teamLeadEmployee: teamLeadId },
      ],
    })
      .populate({
        path: "teamLeadUser",
        select: "name email role uniqueID",
      })
      .populate({
        path: "teamLeadEmployee",
        select: "firstName lastName email employeeID designation",
      })
      .populate({
        path: "employees",
        select: "firstName lastName email employeeID designation",
      })
      .populate({
        path: "interns",
        select: "name email role uniqueID",
      });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found for this team lead",
      });
    }

    return res.status(200).json({
      success: true,
      data: team,
    });

  } catch (error) {
    console.error("Get Team By Team Lead Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
=========================
REMOVE MEMBER FROM TEAM
=========================
*/

exports.removeMemberFromTeam = async (req, res) => {
  try {
    const { teamId, memberId, type } = req.params;

    if (!teamId || !memberId || !type) {
      return res.status(400).json({
        success: false,
        message: "Team ID, Member ID, and Type are required",
      });
    }

    if (!['employee', 'intern'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be 'employee' or 'intern'",
      });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    if (type === 'employee') {
      team.employees = team.employees.filter(
        id => id.toString() !== memberId
      );
    } else {
      team.interns = team.interns.filter(
        id => id.toString() !== memberId
      );
    }

    await team.save();

    return res.status(200).json({
      success: true,
      message: `${type} removed from team successfully`,
      data: team,
    });

  } catch (error) {
    console.error("Remove Member Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};