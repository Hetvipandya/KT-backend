const mongoose = require("mongoose");
const DailyReport = require("../models/DailyReport");
const DailyReportComment = require("../models/DailyReportComment");
const Employee = require("../models/Employee");
require("../models/User");
try { require("../models/projectModel"); } catch (e) {} 
try { require("../models/taskModel"); } catch (e) {}

const parseHoursWorked = (val) => {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val === "number") {
    return isNaN(val) ? null : Math.round(val * 100) / 100;
  }
  if (typeof val === "string") {
    const trimmed = val.trim().replace(",", ".");
    if (trimmed.includes(":")) {
      const parts = trimmed.split(":");
      const h = parseFloat(parts[0]) || 0;
      const m = parseFloat(parts[1]) || 0;
      return parseFloat(h + "." + (m < 10 ? "0" + m : m));
    }
    const num = parseFloat(trimmed);
    return isNaN(num) ? null : Math.round(num * 100) / 100;
  }
  return null;
};

exports.parseHoursWorked = parseHoursWorked;

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

      const parsedHours = parseHoursWorked(hoursWorked);

      if (
        !employeeId ||
        !projectId ||
        !todaysWork ||
        parsedHours === null ||
        isNaN(parsedHours)
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
          hoursWorked: parsedHours,
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


exports.getTeamLeadDailyReports = async (req, res) => {
  try {
    const teamLeadId = req.user?._id?.toString();

    if (!teamLeadId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Get employees assigned to this team lead
    const teamMembers = await getTeamMemberIdsForLead(teamLeadId);

    const memberIds = [
      ...new Set(
        (teamMembers?.allIds || []).map((id) => String(id))
      ),
    ];

    // Find the team lead's employee document
    const teamLeadEmployee = await Employee.findOne({
      $or: [
        { userID: teamLeadId },
        { userId: teamLeadId },
        ...(mongoose.Types.ObjectId.isValid(teamLeadId)
          ? [{ _id: teamLeadId }]
          : []),
      ],
    })
      .select("_id userID userId")
      .lean();

    // Exclude team lead identities
    const excludedIds = new Set([
      teamLeadId,
      ...(teamLeadEmployee
        ? [
            String(teamLeadEmployee._id),
            ...(teamLeadEmployee.userID
              ? [String(teamLeadEmployee.userID)]
              : []),
            ...(teamLeadEmployee.userId
              ? [String(teamLeadEmployee.userId)]
              : []),
          ]
        : []),
    ]);

    const validMemberIds = memberIds.filter(
      (id) =>
        !excludedIds.has(id) &&
        mongoose.Types.ObjectId.isValid(id)
    );

    // Resolve member IDs to actual Employee documents
    const employees = await Employee.find({
      $or: [
        {
          _id: {
            $in: validMemberIds.map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          },
        },
        { userID: { $in: memberIds.filter(
          (id) => !excludedIds.has(id)
        ) } },
        { userId: { $in: memberIds.filter(
          (id) => !excludedIds.has(id)
        ) } },
      ],
    })
      .select("_id userID userId name email")
      .lean();

    // DailyReport.employeeId should normally reference Employee._id
    const employeeIds = [
      ...new Set(
        employees
          .filter((emp) => !excludedIds.has(String(emp._id)))
          .map((emp) => String(emp._id))
      ),
    ];

    console.log("Team Lead:", teamLeadId);
    console.log("Team Member IDs:", memberIds);
    console.log("Resolved Employees:", employees);
    console.log("Employee IDs for Reports:", employeeIds);

    if (employeeIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        message:
          "No matching Employee records found for this team lead.",
        data: [],
      });
    }

    const reports = await DailyReport.find({
      employeeId: {
        $in: employeeIds.map(
          (id) => new mongoose.Types.ObjectId(id)
        ),
      },
    })
      .populate({
        path: "employeeId",
        select: "name role email firstName lastName",
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
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    console.error("Team Lead Daily Reports Error:", error);

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

// ==========================
// UPDATE DAILY REPORT
// ==========================
exports.updateDailyReport = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid daily report id",
      });
    }

    const report = await DailyReport.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Daily report not found",
      });
    }

    const {
      todaysWork,
      pendingWork,
      tomorrowPlan,
      issuesFaced,
      hoursWorked,
      taskReferences,
      remarks,
      status,
      projectId,
      reportDate,
    } = req.body;

    if (todaysWork !== undefined) report.todaysWork = todaysWork;
    if (pendingWork !== undefined) report.pendingWork = pendingWork;
    if (tomorrowPlan !== undefined) report.tomorrowPlan = tomorrowPlan;
    if (issuesFaced !== undefined) report.issuesFaced = issuesFaced;
    if (remarks !== undefined) report.remarks = remarks;
    if (status !== undefined) report.status = status;
    if (projectId !== undefined) report.projectId = projectId;
    if (taskReferences !== undefined) report.taskReferences = taskReferences;
    if (reportDate !== undefined) report.reportDate = reportDate;

    if (hoursWorked !== undefined && hoursWorked !== null && hoursWorked !== "") {
      const parsed = parseHoursWorked(hoursWorked);
      if (parsed === null || isNaN(parsed)) {
        return res.status(400).json({
          success: false,
          message: "Invalid hoursWorked value",
        });
      }
      report.hoursWorked = parsed;
    }

    await report.save();

    const populated = await DailyReport.findById(id)
      .populate("employeeId")
      .populate("projectId")
      .populate({
        path: "taskReferences",
        model: "Task",
        select: "taskTitle status progress projectId",
      });

    return res.status(200).json({
      success: true,
      message: "Daily report updated successfully",
      data: populated || report,
      report: populated || report,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
