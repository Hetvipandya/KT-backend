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

const getTeamIds =
  async (
    teamLeadId
  ) => {
    const team =
      await Team.findOne({
        teamLead:
          new mongoose.Types.ObjectId(
            teamLeadId
          ),
      });

    if (!team)
      return null;

    return [
      ...team
        .developers,
      ...team.interns,
      ...team
        .designers,
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

/*
=========================
GET MY TEAM
=========================
*/

exports.getMyTeam = async (req, res) => {
  try {
    // Logged in Team Lead
    const loggedInUser = req.user;

    // Employee record of logged in Team Lead
    const teamLeadEmployee = await Employee.findOne({
      email: loggedInUser.email,
      isTeamLead: true,
    });

    if (!teamLeadEmployee) {
      return res.status(404).json({
        success: false,
        message: "Team Lead employee record not found",
      });
    }

    // All employees assigned to this Team Lead
    const employees = await Employee.find({
      teamLead: teamLeadEmployee._id,
    })
      .populate("department")
      .populate("designation");

    // Get user details for every employee
    const data = await Promise.all(
      employees.map(async (emp) => {
        const user = await User.findOne({
          email: emp.email,
        });

        return {
          employeeId: emp._id,
          userId: user?._id,

          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          mobile: emp.mobile,

          role: user?.role || "employee",

          department: emp.department,
          designation: emp.designation,

          isTeamLead: emp.isTeamLead,
        };
      })
    );

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
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