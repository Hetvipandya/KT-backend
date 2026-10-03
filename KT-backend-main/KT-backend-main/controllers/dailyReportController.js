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
      const shouldCreateReport = req.body.submit === true || req.body.submit === "true";

      if (!shouldCreateReport) {
        return res.status(400).json({
          success: false,
          message:
            "Daily report creation is disabled by default. Please send submit: true to save the report.",
        });
      }

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
          status: req.body.status || "Pending",
          reportDate: req.body.reportDate || new Date(),
        });

      const { notify } = require('../utils/sendNotification');
      notify({
        userId: req.user?._id,
        companyId: req.user?.companyId,
        type: 'DAILY_REPORT_CREATED',
        title: 'Daily Report Submitted',
        message: `Daily report for ${new Date(report.reportDate).toLocaleDateString()} submitted successfully.`,
        meta: { reportId: report._id.toString() }
      });

      return res.status(201).json({
        success: true,
        message:
          "Daily report created successfully",
        data: report,
        report,
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

const getTeamMemberIdsForLead = async (leadId) => {
  if (!leadId || !mongoose.Types.ObjectId.isValid(leadId)) {
    return { userIds: [], employeeIds: [], allIds: [] };
  }

  const Team = require("../models/Team");
  const User = require("../models/User");
  const Employee = require("../models/Employee");

  const userIds = new Set();
  const employeeIds = new Set();

  const user = await User.findById(leadId).select("_id").lean();
  const employee = await Employee.findById(leadId).select("_id userID userId").lean();

  if (user) userIds.add(user._id.toString());
  if (employee) {
    employeeIds.add(employee._id.toString());
    if (employee.userID) userIds.add(employee.userID.toString());
    if (employee.userId) userIds.add(employee.userId.toString());
  }

  if (!employee && user) {
    const linkedEmp = await Employee.findOne({
      $or: [{ userID: user._id }, { userId: user._id }]
    }).select("_id").lean();
    if (linkedEmp) employeeIds.add(linkedEmp._id.toString());
  }

  const leadUserObjectIds = Array.from(userIds).map(id => new mongoose.Types.ObjectId(id));
  const leadEmpObjectIds = Array.from(employeeIds).map(id => new mongoose.Types.ObjectId(id));

  const teams = await Team.find({
    $or: [
      { teamLeadUser: { $in: leadUserObjectIds } },
      { teamLeadEmployee: { $in: leadEmpObjectIds } },
      { teamLeadUser: leadId },
      { teamLeadEmployee: leadId }
    ]
  }).lean();

  const memberUserIds = new Set(userIds);
  const memberEmployeeIds = new Set(employeeIds);

  for (const team of teams) {
    const rawMembers = [
      ...(team.employees || []),
      ...(team.interns || []),
      ...(team.developers || []),
      ...(team.designers || []),
      ...(team.testers || [])
    ];

    for (const memberId of rawMembers) {
      if (!memberId) continue;
      const strId = memberId.toString();

      const empDoc = await Employee.findById(memberId).select("_id userID userId").lean();
      if (empDoc) {
        memberEmployeeIds.add(empDoc._id.toString());
        if (empDoc.userID) memberUserIds.add(empDoc.userID.toString());
        if (empDoc.userId) memberUserIds.add(empDoc.userId.toString());
      } else {
        memberUserIds.add(strId);
      }
    }
  }

  const directSubordinates = await Employee.find({
    $or: [
      { teamLeadUser: { $in: leadUserObjectIds } },
      { teamLeadEmployee: { $in: leadEmpObjectIds } }
    ]
  }).select("_id userID userId").lean();

  for (const sub of directSubordinates) {
    memberEmployeeIds.add(sub._id.toString());
    if (sub.userID) memberUserIds.add(sub.userID.toString());
    if (sub.userId) memberUserIds.add(sub.userId.toString());
  }

  const combined = Array.from(new Set([...memberUserIds, ...memberEmployeeIds]));

  return {
    userIds: Array.from(memberUserIds),
    employeeIds: Array.from(memberEmployeeIds),
    allIds: combined
  };
};

// ==========================
// GET ALL DAILY REPORTS
// ==========================
exports.getAllDailyReports = async (req, res) => {
  try {
    const { teamLeadId, employeeId, projectId, status } = req.query;

    let filter = {};

    const currentUser = req.user || null;
    const currentUserId = currentUser ? currentUser._id.toString() : null;
    const userRole = String(currentUser?.role || req.query.role || '').toLowerCase();

    const isTLRole = ['teamlead', 'team leader', 'team_lead', 'tl'].includes(userRole);
    const targetLeadId = teamLeadId || (isTLRole ? currentUserId : null);

    let isTeamLeadFilterApplied = false;

    if (targetLeadId) {
      const leadMembers = await getTeamMemberIdsForLead(targetLeadId);
      if (leadMembers.allIds.length > 0) {
        isTeamLeadFilterApplied = true;
        const objectIdList = leadMembers.allIds
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id));
        filter.employeeId = { $in: objectIdList };
      }
    } else if (currentUserId) {
      const leadMembers = await getTeamMemberIdsForLead(currentUserId);
      if (leadMembers.allIds.length > 1) {
        isTeamLeadFilterApplied = true;
        const objectIdList = leadMembers.allIds
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id));
        filter.employeeId = { $in: objectIdList };
      }
    }

    if (!isTeamLeadFilterApplied && employeeId) {
      if (mongoose.Types.ObjectId.isValid(employeeId)) {
        filter.employeeId = new mongoose.Types.ObjectId(employeeId);
      }
    }

    if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
      filter.projectId = new mongoose.Types.ObjectId(projectId);
    }

    if (status) {
      filter.status = status;
    }

    const reports = await DailyReport.find(filter)
      .populate({
        path: "employeeId",
        select: "name role email firstName lastName customerName",
      })
      .populate({
        path: "projectId",
        select: "projectName",
      })
      .populate({
        path: "taskReferences",
        model: "Task",
        select: "taskTitle status progress projectId",
      })
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: reports.length,
      isFilteredByTeamLead: isTeamLeadFilterApplied,
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
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid daily report id",
        });
      }

      const report = await DailyReport.findById(id)
        .populate("employeeId")
        .populate("projectId")
        .populate({
          path: "taskReferences",
          model: "Task",
          select: "taskTitle status progress projectId",
        })
        .populate("reviewedBy");

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Daily report not found",
        });
      }

      const comments = await DailyReportComment.find({
        dailyReportId: id,
      })
        .populate("commentBy")
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        data: report,
        report,
        dailyReport: report,
        comments,
        totalComments: comments.length,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
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