const mongoose = require("mongoose");
const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const Holiday = require("../models/Holiday");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");
const { calculateWorkingLeaveDays, toDateString } = require("../utils/leaveUtils");
const { getTeamLeadForUser } = require("../utils/teamLeadLookup");
const { notify } = require("../utils/sendNotification");

const enrichLeavesWithEmployeeDetails = async (leaves) => {
  if (!leaves) return leaves;
  const isSingle = !Array.isArray(leaves);
  const leaveArray = isSingle ? [leaves] : leaves;
  if (!leaveArray.length) return leaves;

  const rawIds = new Set();
  for (const leave of leaveArray) {
    const rawId =
      (leave?.employeeId && typeof leave.employeeId === "object" && leave.employeeId._id)
        ? String(leave.employeeId._id)
        : leave?.employeeId
          ? String(leave.employeeId)
          : "";
    if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
      rawIds.add(rawId);
    }
  }
  const idArray = Array.from(rawIds);
  const objectIdArray = idArray.map((id) => new mongoose.Types.ObjectId(id));

  let users = [];
  let employees = [];

  if (idArray.length && mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      [users, employees] = await Promise.all([
        User.find({
          $or: [
            { _id: { $in: objectIdArray } },
            { uniqueID: { $in: idArray } },
          ],
        }).select("name email role uniqueID profileImage designation department").lean(),
        Employee.find({
          $or: [
            { _id: { $in: objectIdArray } },
            { userID: { $in: [...objectIdArray, ...idArray] } },
            { userId: { $in: [...objectIdArray, ...idArray] } },
            { employeeID: { $in: idArray } },
            { employeeCode: { $in: idArray } },
          ],
        }).select("_id name firstName lastName middleName email userID userId employeeID employeeCode designation department profileImage profileImg").lean(),
      ]);
    } catch (_) {}
  }

  const userById = new Map();
  const userByEmail = new Map();
  for (const u of users) {
    userById.set(String(u._id), u);
    if (u.email) userByEmail.set(String(u.email).toLowerCase().trim(), u);
  }

  const empByEmpId = new Map();
  const empByUserId = new Map();
  const empByEmail = new Map();
  for (const e of employees) {
    empByEmpId.set(String(e._id), e);
    if (e.userID) empByUserId.set(String(e.userID), e);
    if (e.userId) empByUserId.set(String(e.userId), e);
    if (e.email) empByEmail.set(String(e.email).toLowerCase().trim(), e);
  }

  const enriched = leaveArray.map((doc) => {
    const leave = doc && doc.toObject ? doc.toObject() : (doc ? { ...doc } : {});
    const rawId = String(
      (leave.employeeId && typeof leave.employeeId === "object" && leave.employeeId._id)
        ? leave.employeeId._id
        : leave.employeeId || ""
    );

    const u =
      userById.get(rawId) ||
      (leave.employeeId?.email
        ? userByEmail.get(String(leave.employeeId.email).toLowerCase().trim())
        : null);

    const e =
      empByEmpId.get(rawId) ||
      empByUserId.get(rawId) ||
      (u ? empByUserId.get(String(u._id)) : null) ||
      (u?.email ? empByEmail.get(String(u.email).toLowerCase().trim()) : null) ||
      (leave.employeeId?.email
        ? empByEmail.get(String(leave.employeeId.email).toLowerCase().trim())
        : null);

    const resolvedUser =
      u ||
      (e && (e.userID || e.userId)
        ? userById.get(String(e.userID || e.userId))
        : null);

    const name =
      leave.employeeId?.name ||
      resolvedUser?.name ||
      e?.name ||
      [e?.firstName, e?.lastName].filter(Boolean).join(" ") ||
      leave.employeeName ||
      "Unnamed Employee";

    const firstName =
      e?.firstName ||
      (name && name !== "Unnamed Employee" ? name.split(" ")[0] : "") ||
      "";
    const lastName =
      e?.lastName ||
      (name && name !== "Unnamed Employee" ? name.split(" ").slice(1).join(" ") : "") ||
      "";
    const email =
      leave.employeeId?.email || resolvedUser?.email || e?.email || "";
    const role =
      resolvedUser?.role || e?.role || leave.applicantRole || "employee";
    const employeeID =
      e?.employeeID || e?.employeeCode || resolvedUser?.uniqueID || "";
    const employeeCode =
      e?.employeeCode || e?.employeeID || resolvedUser?.uniqueID || "";
    const uniqueID =
      resolvedUser?.uniqueID || employeeID || "";
    const designation =
      e?.designation || resolvedUser?.designation || "";
    const department =
      e?.department || resolvedUser?.department || "";
    const profileImage =
      e?.profileImage || e?.profileImg || resolvedUser?.profileImage || "";

    const baseEmployeeObj =
      typeof leave.employeeId === "object" && leave.employeeId !== null && !leave.employeeId._bsontype && !Buffer.isBuffer(leave.employeeId)
        ? { ...leave.employeeId }
        : {};
    delete baseEmployeeObj.buffer;

    const employeeObj = {
      ...baseEmployeeObj,
      _id: resolvedUser?._id || e?._id || (mongoose.Types.ObjectId.isValid(rawId) ? new mongoose.Types.ObjectId(rawId) : rawId),
      name,
      firstName,
      lastName,
      email,
      role,
      employeeID,
      employeeCode,
      uniqueID,
      designation,
      department,
      profileImage,
      profileImg: profileImage,
    };

    return {
      ...leave,
      employeeName: name,
      name,
      employeeID,
      employeeCode,
      employee: employeeObj,
      employeeId: employeeObj,
    };
  });

  return isSingle ? enriched[0] : enriched;
};

const getTeamLeadAssignedUserIds = async (teamLeadId) => {
  if (!teamLeadId) return [];

  const rawLeadId = String(teamLeadId).trim();
  const leadUserIds = new Set([rawLeadId]);
  const leadEmployeeIds = new Set();
  const leadIdentifiers = new Set([rawLeadId]);

  let user = null;
  let leadEmployee = null;

  if (mongoose.Types.ObjectId.isValid(rawLeadId)) {
    try {
      user = await User.findById(rawLeadId).select("_id email uniqueID name role").lean();
    } catch (_) {}
    try {
      leadEmployee = await Employee.findById(rawLeadId).select("_id userID userId employeeID employeeCode email name firstName lastName").lean();
    } catch (_) {}
  }

  if (!user) {
    try {
      user = await User.findOne({
        $or: [
          { uniqueID: rawLeadId },
          { email: rawLeadId.toLowerCase() },
        ],
      }).select("_id email uniqueID name role").lean();
    } catch (_) {}
  }

  if (!leadEmployee) {
    try {
      leadEmployee = await Employee.findOne({
        $or: [
          { employeeID: rawLeadId },
          { employeeCode: rawLeadId },
          { email: rawLeadId.toLowerCase() },
          ...(user ? [{ userID: user._id }, { userId: user._id }, { email: user.email?.toLowerCase() }] : []),
        ],
      }).select("_id userID userId employeeID employeeCode email name firstName lastName").lean();
    } catch (_) {}
  }

  if (user) {
    leadUserIds.add(String(user._id));
    if (user.uniqueID) leadIdentifiers.add(String(user.uniqueID));
  }
  if (leadEmployee) {
    leadEmployeeIds.add(String(leadEmployee._id));
    if (leadEmployee.userID) leadUserIds.add(String(leadEmployee.userID));
    if (leadEmployee.userId) leadUserIds.add(String(leadEmployee.userId));
    if (leadEmployee.employeeID) leadIdentifiers.add(String(leadEmployee.employeeID));
    if (leadEmployee.employeeCode) leadIdentifiers.add(String(leadEmployee.employeeCode));
  }

  // Linked employees by userID, userId or email
  try {
    const linkedEmployees = await Employee.find({
      $or: [
        { userID: { $in: Array.from(leadUserIds) } },
        { userId: { $in: Array.from(leadUserIds) } },
        ...(user?.email ? [{ email: user.email.toLowerCase() }] : []),
        ...(leadEmployee?.email ? [{ email: leadEmployee.email.toLowerCase() }] : []),
      ],
    }).select("_id userID userId employeeID employeeCode email").lean();

    for (const employee of linkedEmployees) {
      leadEmployeeIds.add(String(employee._id));
      if (employee.userID) leadUserIds.add(String(employee.userID));
      if (employee.userId) leadUserIds.add(String(employee.userId));
      if (employee.employeeID) leadIdentifiers.add(String(employee.employeeID));
      if (employee.employeeCode) leadIdentifiers.add(String(employee.employeeCode));
    }
  } catch (_) {}

  const leadUserObjectIds = Array.from(leadUserIds)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const leadEmployeeObjectIds = Array.from(leadEmployeeIds)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const leadName =
    user?.name ||
    leadEmployee?.name ||
    [leadEmployee?.firstName, leadEmployee?.lastName].filter(Boolean).join(" ");

  let teams = [];
  try {
    teams = await Team.find({
      $or: [
        { teamLeadUser: teamLeadId },
        { teamLeadUser: { $in: [...leadUserObjectIds, ...Array.from(leadUserIds)] } },
        { teamLeadEmployee: teamLeadId },
        { teamLeadEmployee: { $in: [...leadEmployeeObjectIds, ...Array.from(leadEmployeeIds)] } },
        { teamLeadId: { $in: Array.from(leadIdentifiers) } },
        ...(leadName ? [{ name: new RegExp(`^${leadName.trim()}\\s+Team$`, "i") }] : []),
      ],
    }).select("employees interns developers designers testers teamLeadUser teamLeadEmployee teamLeadId").lean();
  } catch (_) {}

  const assignedUserIds = new Set(leadUserIds);
  for (const team of teams) {
    const rawMemberIds = [
      ...(team.employees || []),
      ...(team.interns || []),
      ...(team.developers || []),
      ...(team.designers || []),
      ...(team.testers || []),
    ].map(String);

    if (!rawMemberIds.length) continue;

    for (const memberId of rawMemberIds) {
      assignedUserIds.add(memberId);
    }

    const memberObjectIds = rawMemberIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    try {
      const [members, linkedUsers] = await Promise.all([
        Employee.find({
          $or: [
            { _id: { $in: [...memberObjectIds, ...rawMemberIds] } },
            { userID: { $in: [...memberObjectIds, ...rawMemberIds] } },
            { userId: { $in: [...memberObjectIds, ...rawMemberIds] } },
          ],
        }).select("_id userID userId email employeeID employeeCode").lean(),
        User.find({
          $or: [
            { _id: { $in: [...memberObjectIds, ...rawMemberIds] } },
          ],
        }).select("_id email uniqueID").lean(),
      ]);

      for (const member of members) {
        assignedUserIds.add(String(member._id));
        if (member.userID) assignedUserIds.add(String(member.userID));
        if (member.userId) assignedUserIds.add(String(member.userId));
        if (member.email) {
          const u = await User.findOne({ email: member.email.toLowerCase() }).select("_id").lean();
          if (u) assignedUserIds.add(String(u._id));
        }
      }

      for (const linkedUser of linkedUsers) {
        assignedUserIds.add(String(linkedUser._id));
        const emps = await Employee.find({
          $or: [
            { userID: linkedUser._id },
            { userId: linkedUser._id },
            ...(linkedUser.email ? [{ email: linkedUser.email.toLowerCase() }] : []),
          ],
        }).select("_id").lean();
        for (const linkedEmp of emps) {
          assignedUserIds.add(String(linkedEmp._id));
        }
      }
    } catch (_) {}
  }

  try {
    const directMembers = await Employee.find({
      $or: [
        { teamLeadUser: { $in: leadUserObjectIds } },
        { teamLeadEmployee: { $in: leadEmployeeObjectIds } },
        { teamLeadId: { $in: Array.from(leadIdentifiers) } },
      ],
    }).select("_id userID userId teamLeadUser teamLeadEmployee teamLeadId").lean();

    for (const member of directMembers) {
      assignedUserIds.add(String(member._id));
      if (member.userID) assignedUserIds.add(String(member.userID));
      if (member.userId) assignedUserIds.add(String(member.userId));
    }
  } catch (_) {}
 
  const result = [];
  for (const id of assignedUserIds) {
    result.push(id);
    if (mongoose.Types.ObjectId.isValid(id)) {
      result.push(new mongoose.Types.ObjectId(id));
    }
  }

  return result;
};

const notifyLeaveDecision = (leave, stage, status, remark) => {
  const employee = leave.employeeId;
  const userId = employee?.userId || employee?._id || employee?.id || employee;
  const decision = status.toUpperCase();
  return notify({
    userId,
    type: `LEAVE_${stage.toUpperCase()}_${decision}`,
    title: `Leave ${status} by ${stage}`,
    message: `Your leave request was ${status} by ${stage}.`,
    meta: {
      leaveId: leave._id.toString(),
      status,
      stage: stage.toLowerCase(),
      reason: remark,
    },
  });
};

// ================= APPLY LEAVE =================
exports.applyLeave = async (req, res) => {
  try {
    const {
      userId: bodyUserId,
      employeeId,
      leaveType,
      startDate,
      endDate,
      reason, 
      isHalfDay,
      halfDayType,
    } = req.body;

    const authenticatedUserId = req.user?._id || req.user?.id;
    const suppliedIdentity = bodyUserId || employeeId || req.body.userID || null;

    if (!authenticatedUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const targetUserId = authenticatedUserId;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    let user = await User.findById(targetUserId);

    if (!user) {
      const Employee = require("../models/Employee");
      const emp = await Employee.findOne({
        $or: [
          { _id: targetUserId },
          { userID: targetUserId },
          { userId: targetUserId },
        ],
      });

      if (emp) {
        const actualUserId = emp.userID || emp.userId || emp._id;
        user = await User.findById(actualUserId);
        if (!user) {
          user = {
            _id: emp._id,
            role: (emp.role || emp.designation || "employee").toLowerCase(),
            name: [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(" ") || "Employee"
          };
        }
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isApproved === false || user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Approved active account required to apply for leave",
      });
    }

    if (suppliedIdentity) {
      const validObjectId = mongoose.Types.ObjectId.isValid(String(suppliedIdentity));
      const employee = await Employee.findOne({
        $or: [
          ...(validObjectId ? [{ _id: suppliedIdentity }] : []),
          { userID: authenticatedUserId },
          { userId: authenticatedUserId },
          { employeeID: suppliedIdentity },
          { employeeCode: suppliedIdentity },
        ],
      });
      const suppliedMatchesUser =
        String(suppliedIdentity) === String(authenticatedUserId) ||
        Boolean(employee && (
          String(employee.userID || employee.userId || "") === String(authenticatedUserId) ||
          String(employee._id) === String(suppliedIdentity) ||
          String(employee.employeeID || "") === String(suppliedIdentity) ||
          String(employee.employeeCode || "") === String(suppliedIdentity)
        ));
      if (!suppliedMatchesUser) {
        return res.status(403).json({
          success: false,
          message: "You cannot apply for leave for another employee",
        });
      }
    }

    const userId = user._id || targetUserId;

    const actualStartDate =
      startDate || req.body.startDate || req.body.leaveDate || req.body.date || req.body.fromDate;
    const actualEndDate = endDate || req.body.endDate || req.body.toDate || actualStartDate;

    const todayStr = toDateString(new Date());
    const startStr = toDateString(actualStartDate);

    if (startStr && startStr < todayStr) {
      return res.status(400).json({
        success: false,
        message: "Cannot apply for leave on past dates. Leave start date must be today or a future date.",
      });
    }

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

    const applierRole = (req.user && req.user.role) ? req.user.role : user.role;
    const normalizedRole = String(user.role || applierRole || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const isEmployeeOrIntern = ["employee", "intern"].includes(normalizedRole);
    const hasAssignedTeamLead =
      !isEmployeeOrIntern || Boolean(await getTeamLeadForUser(userId));

    const leaveStatus =
      user.role === "team lead" || applierRole === "team lead"
        ? "pending_hr"
        : isEmployeeOrIntern && !hasAssignedTeamLead
          ? "pending_hr"
          : user.role === "hr" || applierRole === "hr"
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
        user.role === "team lead" ||
        applierRole === "team lead" ||
        user.role === "hr" ||
        (isEmployeeOrIntern && !hasAssignedTeamLead)
          ? "skipped"
          : "pending",
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

    const enrichedLeave = await enrichLeavesWithEmployeeDetails(leave);

    res.status(201).json({
      success: true,
      message: "Leave request sent successfully",
      data: enrichedLeave,
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
    const { role, _id } = req.user || {};
    const normalizedRole = String(role || "")
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

    let filter = {};

    // Employee & Intern → Only own leaves
    if (normalizedRole === "employee" || normalizedRole === "intern") {
      filter = { employeeId: _id };
    }

    // Team Lead, HR, Admin → All leaves
    else if (normalizedRole === "hr") {
      filter = { applicantRole: { $ne: "hr" } };
    }

    else if (normalizedRole === "teamlead") {
      const assignedUserIds = await getTeamLeadAssignedUserIds(_id);
      filter = {
        employeeId: { $in: assignedUserIds },
        applicantRole: { $ne: "hr" },
      };
    }

    // Admin → All leaves, including HR leaves
    else if (normalizedRole === "admin") {
      filter = {};
    }

    else {
      return res.status(403).json({
        success: false,
        message: `Role "${role}" is not authorized to view leaves.`,
      });
    }

    const leaves = await Leave.find(filter)
      .populate({
        path: "employeeId",
        select: "name email role",
      })
      .sort({ createdAt: -1 });

    const enrichedLeaves = await enrichLeavesWithEmployeeDetails(leaves);

    return res.status(200).json({
      success: true,
      total: enrichedLeaves.length,
      data: enrichedLeaves,
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
    const userId = req.user?._id;
    let user = null;
    try {
      user = await User.findById(userId);
    } catch (_) {}

    let isTL = false;
    if (user) {
      const normalizedRole = String(user.role || "")
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
      isTL = normalizedRole === "teamlead";
    }
    if (!isTL) {
      try {
        const emp = await Employee.findOne({
          $or: [{ _id: userId }, { userID: userId }, { userId: userId }],
        });
        if (emp) {
          const empRole = String(emp.role || "").toLowerCase().replace(/[\s_-]+/g, "");
          isTL = Boolean(emp.isTeamLead) || empRole === "teamlead";
        }
      } catch (_) {}
    }
    if (!isTL && req.user?.role) {
      const reqRole = String(req.user.role || "").toLowerCase().replace(/[\s_-]+/g, "");
      isTL = reqRole === "teamlead";
    }

    if (!isTL) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Team Leads can view pending leaves.",
      });
    }

    const assignedUserIds = await getTeamLeadAssignedUserIds(userId);
    const leaves = await Leave.find({
      applicantRole: { $in: ["employee", "intern"] },
      teamLeadStatus: "pending",
      status: "pending",
      employeeId: { $in: assignedUserIds },
    })
      .populate({
        path: "employeeId",
        select: "name email role",
      })
      .sort({ createdAt: -1 });

    const enrichedLeaves = await enrichLeavesWithEmployeeDetails(leaves);

    return res.status(200).json({
      success: true,
      total: enrichedLeaves.length,
      data: enrichedLeaves,
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

    const enrichedLeaves = await enrichLeavesWithEmployeeDetails(leaves);

    return res.status(200).json({
      success: true,
      total: enrichedLeaves.length,
      data: enrichedLeaves,
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
    await notifyLeaveDecision(leave, "TEAM_LEAD", status, remarkText);

    const enrichedLeave = await enrichLeavesWithEmployeeDetails(leave);

    res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Leave approved by team lead and forwarded to HR"
          : "Leave rejected by team lead",
      data: enrichedLeave,
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

      if (!["approved", "skipped"].includes(leave.teamLeadStatus)) {
        return res.status(400).json({
          success: false,
          message: "Leave must be approved by Team Lead first unless no Team Lead is assigned",
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
    await notifyLeaveDecision(leave, "HR", status, remarkText);

    const enrichedLeave = await enrichLeavesWithEmployeeDetails(leave);

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Leave approved successfully"
          : "Leave rejected successfully",
      data: enrichedLeave,
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

    const enrichedLeaves = await enrichLeavesWithEmployeeDetails(leaves);

    res.status(200).json({
      success: true,
      total: enrichedLeaves.length,
      data: enrichedLeaves,
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
    await notifyLeaveDecision(leave, "ADMIN", status, remarkText);

    const enrichedLeave = await enrichLeavesWithEmployeeDetails(leave);

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Leave approved by Admin successfully."
          : "Leave rejected by Admin successfully.",
      data: enrichedLeave,
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

    if (!holidayName || !holidayDate) {
      return res.status(400).json({
        success: false,
        message: "holidayName and holidayDate are required",
      });
    }

    const dateStr = toDateString(holidayDate);
    const existing = await Holiday.findOne({
      holidayDate: {
        $gte: new Date(`${dateStr}T00:00:00.000Z`),
        $lte: new Date(`${dateStr}T23:59:59.999Z`),
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Holiday on date ${dateStr} already exists (${existing.holidayName})`,
        data: existing,
      });
    }

    const holiday = await Holiday.create({
      holidayName,
      holidayDate,
      isPublicHoliday: isPublicHoliday !== undefined ? isPublicHoliday : true,
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

// ================= CALCULATE LEAVE DAYS PREVIEW =================
exports.calculateLeaveDays = async (req, res) => {
  try {
    const { startDate, endDate, isHalfDay, leaveType } = req.body;
    const actualStartDate = startDate || req.body.leaveDate || req.body.date || req.body.fromDate;
    const actualEndDate = endDate || req.body.toDate || actualStartDate;

    const isHalfDayBool =
      isHalfDay === true ||
      isHalfDay === "true" ||
      leaveType === "half_day" ||
      Number(req.body.totalDays) === 0.5;

    const calculation = await calculateWorkingLeaveDays(
      actualStartDate,
      actualEndDate,
      isHalfDayBool,
    );

    return res.status(200).json({
      success: true,
      message: "Leave days calculated successfully",
      data: calculation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
