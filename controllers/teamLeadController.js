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

const getTeamIds = async (teamLeadId) => {
  console.log("Logged In Team Lead ID:", teamLeadId);

  const team = await Team.findOne({
    teamLead: new mongoose.Types.ObjectId(teamLeadId),
  });

  console.log("Team Found:", team);

  if (!team) return null;

  return [
    ...team.developers,
    ...team.interns,
    ...team.designers,
    ...team.testers,
  ];
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
      developers = [],
      interns = [],
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
    // CHECK USER COLLECTION
    // ===========================

    const user = await User.findById(teamLead);

    if (user) {
      teamLeadUser = user._id;

      // check only by user id
      team = await Team.findOne({
        teamLeadUser: teamLeadUser,
      });
    }

    // ===========================
    // CHECK EMPLOYEE COLLECTION
    // ===========================

    if (!user) {
      const employee = await Employee.findById(teamLead);

      if (employee && employee.isTeamLead) {
        teamLeadEmployee = employee._id;

        // check only by employee id
        team = await Team.findOne({
          teamLeadEmployee: teamLeadEmployee,
        });
      }
    }

    if (!teamLeadUser && !teamLeadEmployee) {
      return res.status(404).json({
        success: false,
        message: "Team Lead not found",
      });
    }

    // ===========================
    // UPDATE EXISTING TEAM
    // ===========================

    if (team) {
      team.developers = developers;
      team.interns = interns;
      team.designers = designers;
      team.testers = testers;

      await team.save();

      return res.status(200).json({
        success: true,
        message: "Team Updated Successfully",
        data: team,
      });
    }

    // ===========================
    // CREATE NEW TEAM
    // ===========================

    const newTeam = await Team.create({
      teamLeadUser,
      teamLeadEmployee,
      developers,
      interns,
      designers,
      testers,
    });

    return res.status(201).json({
      success: true,
      message: "Team Created Successfully",
      data: newTeam,
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


        totalInterns:
          team.interns?.length || 0,


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