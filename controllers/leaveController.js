const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const Holiday = require("../models/Holiday");
const User = require("../models/User");
const { calculateWorkingLeaveDays } = require("../utils/leaveUtils");

// ================= APPLY LEAVE =================
exports.applyLeave = async (req, res) => {
  try {
    const {
      userId,
      leaveType,
      startDate,
      endDate,
      reason,
      isHalfDay,
      halfDayType,
    } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const actualStartDate =
      startDate || req.body.leaveDate || req.body.date || req.body.fromDate;
    const actualEndDate = endDate || req.body.toDate || actualStartDate;

    const isHalfDayBool =
      isHalfDay === true ||
      isHalfDay === "true" ||
      req.body.halfDay === true ||
      req.body.halfDay === "true" ||
      req.body.is_half_day === true ||
      req.body.is_half_day === "true" ||
      leaveType === "half_day" ||
      String(req.body.duration || "")
        .toLowerCase()
        .includes("half") ||
      String(req.body.durationType || "")
        .toLowerCase()
        .includes("half") ||
      String(req.body.selectedDuration || "")
        .toLowerCase()
        .includes("half") ||
      String(req.body.dayType || "")
        .toLowerCase()
        .includes("half") ||
      Number(req.body.totalDays) === 0.5 ||
      Number(req.body.duration) === 0.5 ||
      Boolean(req.body.halfDayType);

    let normalizedLeaveType = leaveType;
    if (!normalizedLeaveType || normalizedLeaveType === "half_day") {
      normalizedLeaveType = "casual";
    } else {
      normalizedLeaveType = String(normalizedLeaveType).toLowerCase().trim();
    }

    let normalizedHalfDayType = null;
    if (isHalfDayBool) {
      const rawHalfType = String(
        halfDayType ||
          req.body.half_day_type ||
          req.body.durationType ||
          req.body.selectedDuration ||
          "",
      ).toLowerCase();

      if (rawHalfType.includes("second") || rawHalfType.includes("2nd")) {
        normalizedHalfDayType = "second-half";
      } else {
        normalizedHalfDayType = "first-half";
      }
    }

    // Calculate working days excluding Sundays and Company-declared Holidays
    const {
      workingDays,
      totalCalendarDays,
      excludedSundays,
      excludedHolidays,
    } = await calculateWorkingLeaveDays(
      actualStartDate,
      actualEndDate,
      isHalfDayBool,
    );

    const totalDays = workingDays;

    // Check if leave balance is sufficient (only when totalDays > 0)
    const balance = await LeaveBalance.findOne({ employeeId: userId });
    if (balance && totalDays > 0 && balance.remainingLeaves < totalDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. Requested: ${totalDays} working days, Remaining: ${balance.remainingLeaves}`,
      });
    }

    const leaveStatus =
      user.role === "team lead"
        ? "pending_hr"
        : user.role === "hr"
          ? "pending_admin"
          : "pending";

    const leave = await Leave.create({
      employeeId: userId,
      applicantRole: user.role,
      leaveType: normalizedLeaveType,
      startDate: actualStartDate,
      endDate: actualEndDate,
      totalDays,
      isHalfDay: isHalfDayBool,
      halfDayType: normalizedHalfDayType,
      reason: reason || req.body.remark || "",
      // Team Lead leave goes directly to HR and HR leave goes directly to Admin
      status: leaveStatus,
      teamLeadStatus:
        user.role === "team lead" || user.role === "hr" ? "skipped" : "pending",
      hrStatus: "pending",
    });

    // Auto create leave balance if not exists
    const existingBalance = await LeaveBalance.findOne({ employeeId: userId });

    if (!existingBalance) {
      await LeaveBalance.create({
        employeeId: userId,
        totalLeaves: 20,
        usedLeaves: 0,
        remainingLeaves: 20,
      });
    }

    res.status(201).json({
      success: true,
      message: "Leave request sent successfully",
      data: leave,
      calculation: {
        workingDays,
        totalCalendarDays,
        excludedSundays,
        excludedHolidays,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET ALL LEAVES (Role-Based) =================
exports.getAllLeaves = async (req, res) => {
  try {
    const { role, _id } = req.user;

    let filter = {};

    // Employee & Intern → Only own leaves
    if (role === "employee" || role === "intern") {
      filter = { employeeId: _id };
    }

    // Team Lead, HR, Admin → All leaves
    else if (role === "team lead" || role === "hr") {
      filter = { applicantRole: { $ne: "hr" } };
    }

    // Admin → All leaves, including HR leaves
    else if (role === "admin") {
      filter = {};
    }

    const leaves = await Leave.find(filter)
      .populate({
        path: "employeeId",
        select: "name email role",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: leaves.length,
      data: leaves,
    });
  } catch (error) {
    console.error("GET ALL LEAVES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET TEAM LEAD PENDING LEAVES =================
exports.getTeamLeadPendingLeaves = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user || user.role !== "team lead") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Team Leads can view pending leaves.",
      });
    }

    // Get all employees and interns under this team lead (if you have team mapping)
    // For now, fetch all pending employee/intern leaves
    const leaves = await Leave.find({
      applicantRole: { $in: ["employee", "intern"] },
      teamLeadStatus: "pending",
      status: "pending",
    })
      .populate({
        path: "employeeId",
        select: "name email role",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: leaves.length,
      data: leaves,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET HR PENDING LEAVES =================
exports.getHRPendingLeaves = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user || user.role !== "hr") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only HR can view pending leaves.",
      });
    }

    const leaves = await Leave.find({
      status: "pending_hr",
      applicantRole: { $ne: "hr" },
      hrStatus: "pending",
    })
      .populate({
        path: "employeeId",
        select: "name email role",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: leaves.length,
      data: leaves,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= UPDATE LEAVE BALANCE =================
const updateLeaveBalance = async (leave) => {
  let balance = await LeaveBalance.findOne({
    employeeId: leave.employeeId,
  });

  if (!balance) {
    balance = await LeaveBalance.create({
      employeeId: leave.employeeId,
      totalLeaves: 20,
      usedLeaves: 0,
      remainingLeaves: 20,
    });
  }

  balance.usedLeaves += leave.totalDays;
  balance.remainingLeaves -= leave.totalDays;

  await balance.save();
};

const revertLeaveBalance = async (leave) => {
  let balance = await LeaveBalance.findOne({
    employeeId: leave.employeeId,
  });

  if (balance) {
    balance.usedLeaves = Math.max(0, balance.usedLeaves - leave.totalDays);
    balance.remainingLeaves = balance.totalLeaves - balance.usedLeaves;
    await balance.save();
  }
};

// ================= TEAM LEAD APPROVAL =================
// ================= TEAM LEAD APPROVAL =================
exports.teamLeadApproval = async (req, res) => {
  try {
    const { leaveId, status, remark, description } = req.body;
    const remarkText = (remark || description || "").trim();

    if (!leaveId) {
      return res.status(400).json({
        success: false,
        message: "Leave ID is required",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    if (!remarkText) {
      return res.status(400).json({
        success: false,
        message: "Description / Remark is required",
      });
    }

    const leave = await Leave.findById(leaveId).populate("employeeId");

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave not found",
      });
    }

    // 🔥 Check: Team Lead cannot approve their OWN leave
    if (leave.employeeId._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot approve your own leave. It will be directly processed by HR.",
      });
    }

    // Check if this is an employee/intern leave
    if (!["employee", "intern"].includes(leave.applicantRole)) {
      return res.status(400).json({
        success: false,
        message: "Team Lead can only approve employee/intern leaves",
      });
    }

    if (leave.teamLeadStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Leave already processed by Team Lead",
      });
    }

    leave.teamLeadStatus = status;
    if (remarkText) {
      leave.remark = remarkText;
      leave.description = remarkText;
      leave.teamLeadRemark = remarkText;
    }

    if (status === "approved") {
      leave.status = "pending_hr";
      leave.hrStatus = "pending";
    } else {
      leave.status = "rejected";
      leave.hrStatus = "rejected";
    }

    await leave.save();

    res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Leave approved by team lead and forwarded to HR"
          : "Leave rejected by team lead",
      data: leave,
    });
  } catch (error) {
    console.error("Team Lead Approval Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= HR APPROVAL =================
// ================= HR APPROVAL =================
exports.hrApproval = async (req, res) => {
  try {
    const { leaveId, status, remark, description } = req.body;
    const remarkText = (remark || description || "").trim();

    if (!leaveId) {
      return res.status(400).json({
        success: false,
        message: "Leave ID is required",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    if (!remarkText) {
      return res.status(400).json({
        success: false,
        message: "Description / Remark is required",
      });
    }

    const leave = await Leave.findById(leaveId).populate("employeeId");

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave not found",
      });
    }

    console.log("========== HR APPROVAL ==========");
    console.log("Applicant Role:", leave.applicantRole);
    console.log("Employee Role:", leave.employeeId?.role);
    console.log("Leave Status:", leave.status);
    console.log("TL Status:", leave.teamLeadStatus);
    console.log("HR Status:", leave.hrStatus);

    if (leave.applicantRole === "hr" || leave.employeeId?.role === "hr") {
      return res.status(400).json({
        success: false,
        message: "HR leave requests must be approved by Admin only.",
      });
    }

    const currentRole = (leave.employeeId?.role || leave.applicantRole || "")
      .toLowerCase()
      .replace(/\s+/g, "");

    const isTeamLead =
      currentRole === "teamlead" || currentRole === "team lead";

    if (!leave.applicantRole && leave.employeeId?.role) {
      leave.applicantRole = leave.employeeId.role;
    }

    if (leave.hrStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Leave already processed by HR",
      });
    }

    // ==========================
    // TEAM LEAD LEAVE (Direct HR Approval)
    // ==========================
    if (isTeamLead) {
      console.log("✅ Team Lead Leave -> Direct HR Approval");

      if (leave.teamLeadStatus !== "skipped") {
        leave.teamLeadStatus = "skipped";
      }
    }

    // ==========================
    // EMPLOYEE / INTERN LEAVE (Must be approved by TL first)
    // ==========================
    else {
      console.log("👤 Employee / Intern Leave");

      if (leave.teamLeadStatus !== "approved") {
        return res.status(400).json({
          success: false,
          message: "Leave must be approved by Team Lead first",
        });
      }
    }

    // ==========================
    // HR DECISION
    // ==========================
    if (status === "approved") {
      leave.hrStatus = "approved";
      leave.status = "approved";

      await updateLeaveBalance(leave);
    } else {
      leave.hrStatus = "rejected";
      leave.status = "rejected";
    }

    if (remarkText) {
      leave.remark = remarkText;
      leave.description = remarkText;
      leave.hrRemark = remarkText;
    }

    await leave.save();

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Leave approved successfully"
          : "Leave rejected successfully",
      data: leave,
    });
  } catch (error) {
    console.error("HR Approval Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET USER LEAVES =================
exports.getMyLeaves = async (req, res) => {
  try {
    const { userId } = req.params;

    const leaves = await Leave.find({ employeeId: userId })
      .populate("employeeId", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      total: leaves.length,
      data: leaves,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= ADMIN APPROVAL =================
exports.adminApproval = async (req, res) => {
  try {
    const { leaveId, status, remark, description } = req.body;
    const remarkText = (remark || description || "").trim();

    // Validation
    if (!leaveId) {
      return res.status(400).json({
        success: false,
        message: "Leave ID is required",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    if (!remarkText) {
      return res.status(400).json({
        success: false,
        message: "Description / Remark is required",
      });
    }

    // Route middleware already verifies admin role
    console.log("========== ADMIN APPROVAL ==========");
    console.log("Logged In User:", req.user);

    // Get Leave
    const leave = await Leave.findById(leaveId).populate("employeeId");

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave not found",
      });
    }

    console.log("Leave ID:", leave._id);
    console.log("Applicant Role:", leave.applicantRole);
    console.log("Current Status:", leave.status);
    console.log("Team Lead Status:", leave.teamLeadStatus);
    console.log("HR Status:", leave.hrStatus);
    console.log("Admin Action:", status);

    const previousStatus = leave.status;

    if (status === "approved") {
      leave.status = "approved";
      leave.teamLeadStatus = "approved";
      leave.hrStatus = "approved";

      // Deduct Leave Balance if changing from non-approved to approved
      if (previousStatus !== "approved") {
        await updateLeaveBalance(leave);
      }
    } else {
      leave.status = "rejected";
      leave.teamLeadStatus = "rejected";
      leave.hrStatus = "rejected";

      // Revert Leave Balance if changing from approved to rejected
      if (previousStatus === "approved") {
        await revertLeaveBalance(leave);
      }
    }

    if (remarkText) {
      leave.remark = remarkText;
      leave.description = remarkText;
      leave.adminRemark = remarkText;
    }

    leave.adminApprovedBy = req.user._id;
    leave.adminApprovedAt = new Date();

    await leave.save();

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Leave approved by Admin successfully."
          : "Leave rejected by Admin successfully.",
      data: leave,
    });
  } catch (error) {
    console.error("Admin Approval Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ================= GET LEAVE BALANCE =================
exports.getLeaveBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    let balance = await LeaveBalance.findOne({ employeeId: userId });

    if (!balance) {
      balance = await LeaveBalance.create({
        employeeId: userId,
        totalLeaves: 20,
        usedLeaves: 0,
        remainingLeaves: 20,
      });
    }

    res.status(200).json({
      success: true,
      data: balance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= CREATE HOLIDAY =================
exports.createHoliday = async (req, res) => {
  try {
    const { holidayName, holidayDate, isPublicHoliday } = req.body;

    const holiday = await Holiday.create({
      holidayName,
      holidayDate,
      isPublicHoliday,
    });

    res.status(201).json({
      success: true,
      message: "Holiday created successfully",
      data: holiday,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET ALL HOLIDAYS =================
exports.getAllHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ holidayDate: 1 });

    res.status(200).json({
      success: true,
      total: holidays.length,
      data: holidays,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
