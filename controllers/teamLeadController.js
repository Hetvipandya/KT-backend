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

    const teamLeadUser = await User.findById(teamLead);

    if (!teamLeadUser) {
      return res.status(404).json({
        success: false,
        message: "Team Lead not found",
      });
    }

    let team = await Team.findOne({
      teamLead,
    });

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

    team = await Team.create({
      teamLead,
      developers,
      interns,
      designers,
      testers,
    });

    return res.status(201).json({
      success: true,
      message: "Team Created Successfully",
      data: team,
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
GET MY TEAM
=========================
*/

exports.getMyTeam = async (req, res) => {
  try {
    // User collection માંથી Team Leads
    const users = await User.find({
      role: { $regex: /^team\s*lead$/i },
    }).select("name email role uniqueID");

    // Employee collection માંથી Team Leads
    const employees = await Employee.find({
      isTeamLead: true,
    }).populate("department");

    // Merge by email
    const merged = employees.map((emp) => {
      const user = users.find(
        (u) =>
          u.email?.toLowerCase() ===
          emp.email?.toLowerCase()
      );

      return {
        _id: emp._id,
        userId: user?._id || null,

        firstName: emp.firstName,
        lastName: emp.lastName,

        name:
          user?.name ||
          `${emp.firstName} ${emp.lastName}`,

        email: emp.email,
        mobile: emp.mobile,

        role: user?.role || "team lead",

        designation: emp.designation,
        department: emp.department,

        employeeID: emp.employeeID,
        isTeamLead: emp.isTeamLead,
      };
    });

    // User માં છે પણ Employee માં નથી
    const remainingUsers = users
      .filter(
        (user) =>
          !employees.some(
            (emp) =>
              emp.email?.toLowerCase() ===
              user.email?.toLowerCase()
          )
      )
      .map((user) => ({
        _id: user._id,
        userId: user._id,

        name: user.name,
        email: user.email,
        role: user.role,

        firstName: "",
        lastName: "",

        mobile: "",
        designation: "",
        department: "",

        employeeID: "",
        isTeamLead: false,
      }));

    return res.status(200).json({
      success: true,
      total: merged.length + remainingUsers.length,
      data: [...merged, ...remainingUsers],
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