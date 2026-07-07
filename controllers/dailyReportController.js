const mongoose = require("mongoose");
const DailyReport = require("../models/DailyReport");
const DailyReportComment = require("../models/DailyReportComment");

// ==========================
// CREATE DAILY REPORT / COMMENT
// ==========================
exports.createDailyReport =
  async (req, res) => {
    try {
      console.log(
        "BODY ===>",
        req.body
      );

      const {
        employeeId,
        projectId,
        todaysWork,
        pendingWork,
        tomorrowPlan,
        issuesFaced,
        hoursWorked,
        taskReferences,
        remarks,

        // comment fields
        dailyReportId,
        commentBy,
        comment,
      } = req.body;

      // ==================================
      // COMMENT SAVE FLOW
      // ==================================
      if (dailyReportId) {
        const report =
          await DailyReport.findById(
            dailyReportId
          );

        if (!report) {
          return res.status(404).json({
            success: false,
            message:
              "Daily report not found",
          });
        }

        const savedComment =
          await DailyReportComment.create(
            {
              dailyReportId,
              commentBy,
              comment,
            }
          );

        const reportData =
          await DailyReport.findById(
            dailyReportId
          )
            .populate(
              "employeeId"
            )
            .populate(
              "projectId"
            )
            .populate(
              "taskReferences"
            );

        return res.status(201).json({
          success: true,
          message:
            "Comment added successfully",
          dailyReport:
            reportData,
          comment:
            savedComment,
        });
      }

      // ==================================
      // DAILY REPORT CREATE FLOW
      // ==================================
      if (
        !employeeId ||
        !projectId ||
        !todaysWork ||
        !hoursWorked
      ) {
        return res.status(400).json({
          success: false,
          message:
            "employeeId, projectId, todaysWork and hoursWorked are required",
        });
      }

      const report =
        await DailyReport.create({
          employeeId,
          projectId,
          todaysWork,
          pendingWork,
          tomorrowPlan,
          issuesFaced,
          hoursWorked,
          taskReferences:
            taskReferences || [],
          remarks,
        });

      return res.status(201).json({
        success: true,
        message:
          "Daily report created successfully",
        data: report,
      });
    } catch (error) {
      console.log(
        "ERROR ===>",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ==========================
// GET ALL DAILY REPORTS
// ==========================
exports.getAllDailyReports = async (req, res) => {
  try {
    const reports = await DailyReport.find()
      .populate({
        path: "projectId",
        select: "projectName", // Project schema ma je field hoy e lakho
      })
      .populate({
        path: "taskReferences",
        select: "taskTitle",
      })
      .sort({
        createdAt: -1,
      });

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

// ==========================
// GET SINGLE DAILY REPORT
// ==========================
exports.getSingleDailyReport =
  async (req, res) => {
    try {
      const report =
        await DailyReport.findById(
          req.params.id
        )
          .populate(
            "employeeId"
          )
          .populate(
            "projectId"
          )
          .populate(
            "taskReferences"
          )
          .populate(
            "reviewedBy"
          );

      const comments =
        await DailyReportComment.find(
          {
            dailyReportId:
              req.params.id,
          }
        ).populate(
          "commentBy"
        );

      return res.status(200).json({
        success: true,
        data: report,
        comments,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ==========================
// UPDATE REPORT STATUS
// ==========================
exports.updateReportStatus =
  async (req, res) => {
    try {
      const {
        status,
        reviewedBy,
        comment,
      } = req.body;

      const report =
        await DailyReport.findById(
          req.params.id
        );

      if (!report) {
        return res.status(404).json({
          success: false,
          message:
            "Report not found",
        });
      }

      report.status =
        status;
      report.reviewedBy =
        reviewedBy;
      report.reviewedAt =
        new Date();

      await report.save();

      if (
        comment &&
        reviewedBy
      ) {
        await DailyReportComment.create(
          {
            dailyReportId:
              report._id,
            commentBy:
              reviewedBy,
            comment,
          }
        );
      }

      return res.status(200).json({
        success: true,
        message:
          "Status updated successfully",
        data: report,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ==========================
// ADD COMMENT
// ==========================
exports.addComment =
  async (req, res) => {
    try {
      const {
        commentBy,
        comment,
      } = req.body;

      const savedComment =
        await DailyReportComment.create(
          {
            dailyReportId:
              req.params.id,
            commentBy,
            comment,
          }
        );

      return res.status(201).json({
        success: true,
        data:
          savedComment,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ==========================
// DELETE DAILY REPORT
// ==========================
exports.deleteDailyReport =
  async (req, res) => {
    try {
      await DailyReport.findByIdAndDelete(
        req.params.id
      );

      await DailyReportComment.deleteMany(
        {
          dailyReportId:
            req.params.id,
        }
      );

      return res.status(200).json({
        success: true,
        message:
          "Deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };