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

exports.getMyTeam =
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

      const employees =
        await User.find(
          {
            _id: {
              $in:
                teamIds,
            },
          }
        ).select(
          "name email role"
        );

      return res
        .status(200)
        .json({
          success:
            true,
          data:
            employees,
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