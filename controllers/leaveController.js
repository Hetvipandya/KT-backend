const mongoose = require("mongoose");
const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const Holiday = require("../models/Holiday");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");
let Project = null;
try { Project = require("../models/projectModel"); } catch (_) {}
let TeamMember = null;
try { TeamMember = require("../models/TeamMember"); } catch (_) {}
const {
  calculateWorkingLeaveDays,
  normalizeLeaveDuration,
  toDateString,
  validateLeaveDateRange,
} = require("../utils/leaveUtils");
const { getTeamLeadForUser } = require("../utils/teamLeadLookup");
const { notify } = require("../utils/sendNotification");
const { recordAuditEvent } = require("../services/auditLog.service");

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

const normalizeRoleString = (r) => {
  const compact = String(r?.roleName || r?.name || r?.slug || r || "")
    .trim()
    .toLowerCase()
    .replace(/[_s-]+/g, "");
  if (compact === "teamlead" || compact === "teamleader" || compact === "tl") return "teamlead";
  if (compact === "superadmin" || compact === "administrator" || compact.includes("admin")) return "admin";
  if (compact === "hr" || compact === "hrmanager" || compact === "hradmin" || compact.startsWith("hr")) return "hr";
  return compact;
};

const isUserAdminOrHr = (user) => {
  if (!user) return false;
  const rolesToCheck = [];
  if (user.role) rolesToCheck.push(user.role);
  if (user.userRole) rolesToCheck.push(user.userRole);
  if (user.roleName) rolesToCheck.push(user.roleName);
  if (user.designation) rolesToCheck.push(user.designation);
  if (Array.isArray(user.roles)) {
    user.roles.forEach((r) => rolesToCheck.push(r));
  }
  if (Array.isArray(user.companyAccess)) {
    user.companyAccess.forEach((a) => {
      if (a && a.isActive !== false && a.role) rolesToCheck.push(a.role);
    });
  }

  return rolesToCheck.some((r) => {
    const roleNorm = normalizeRoleString(r);
    return roleNorm === "admin" || roleNorm === "hr";
  });
};

const isUserTeamLead = async (user, userId) => {
  if (user) {
    const roleNorm = normalizeRoleString(user.role);
    if (roleNorm === "teamlead") return true;
  }

  if (!userId) return false;

  const rawId = String(userId).trim();
  const idQueries = [{ _id: rawId }, { userID: rawId }, { userId: rawId }];
  if (user?.email) {
    idQueries.push({ email: user.email.toLowerCase() });
  }

  try {
    const emp = await Employee.findOne({ $or: idQueries })
      .select("_id role isTeamLead designation")
      .lean();
    if (emp) {
      const empRole = normalizeRoleString(emp.role);
      const empDesignation = normalizeRoleString(emp.designation);
      if (emp.isTeamLead === true || empRole === "teamlead" || empDesignation === "teamlead") {
        return true;
      }
    }
  } catch (_) {}

  try {
    const objectId = mongoose.Types.ObjectId.isValid(rawId) ? new mongoose.Types.ObjectId(rawId) : null;
    const leadMatch = objectId ? [rawId, objectId] : [rawId];

    const [hasTeam, hasSubordinate] = await Promise.all([
      Team.exists({
        $or: [
          { teamLeadUser: { $in: leadMatch } },
          { teamLeadEmployee: { $in: leadMatch } },
          { teamLead: { $in: leadMatch } },
          { teamLeadId: rawId },
        ],
      }),
      Employee.exists({
        $or: [
          { teamLeadUser: { $in: leadMatch } },
          { teamLeadEmployee: { $in: leadMatch } },
          { teamLead: { $in: leadMatch } },
          { teamLeadId: rawId },
        ],
      }),
    ]);

    if (hasTeam || hasSubordinate) return true;
  } catch (_) {}

  return false;
};

const getTeamLeadAssignedUserIds = async (teamLeadId) => {
  if (!teamLeadId) return [];

  const rawLeadId = String(teamLeadId).trim();
  const leadUserIds = new Set([rawLeadId]);
  const leadEmployeeIds = new Set();
  const leadIdentifiers = new Set([rawLeadId]);
  const leadEmails = new Set();

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
    if (user.email) leadEmails.add(String(user.email).toLowerCase().trim());
  }
  if (leadEmployee) {
    leadEmployeeIds.add(String(leadEmployee._id));
    if (leadEmployee.userID) leadUserIds.add(String(leadEmployee.userID));
    if (leadEmployee.userId) leadUserIds.add(String(leadEmployee.userId));
    if (leadEmployee.employeeID) leadIdentifiers.add(String(leadEmployee.employeeID));
    if (leadEmployee.employeeCode) leadIdentifiers.add(String(leadEmployee.employeeCode));
    if (leadEmployee.email) leadEmails.add(String(leadEmployee.email).toLowerCase().trim());
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
      if (employee.email) leadEmails.add(String(employee.email).toLowerCase().trim());
    }
  } catch (_) {}

  // Linked users by email
  if (leadEmails.size > 0) {
    try {
      const linkedUsers = await User.find({
        email: { $in: Array.from(leadEmails) },
      }).select("_id uniqueID email").lean();
      for (const u of linkedUsers) {
        leadUserIds.add(String(u._id));
        if (u.uniqueID) leadIdentifiers.add(String(u.uniqueID));
      }
    } catch (_) {}
  }

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

  const assignedUserIds = new Set(leadUserIds);
  const discoveredEmployeeIds = new Set();
  const discoveredUserIds = new Set();
  const discoveredEmails = new Set();

  // 1. Teams where this user is Team Lead
  try {
    const teamLeadMatchConditions = [
      { teamLeadUser: { $in: [...leadUserObjectIds, ...Array.from(leadUserIds)] } },
      { teamLeadEmployee: { $in: [...leadEmployeeObjectIds, ...Array.from(leadEmployeeIds)] } },
      { teamLead: { $in: [...leadUserObjectIds, ...leadEmployeeObjectIds, ...Array.from(leadUserIds), ...Array.from(leadEmployeeIds)] } },
      { teamLeadId: { $in: Array.from(leadIdentifiers) } },
    ];
    if (leadName) {
      teamLeadMatchConditions.push({ name: new RegExp(`^${leadName.trim()}\\s+Team$`, "i") });
    }

    const teams = await Team.find({ $or: teamLeadMatchConditions })
      .select("employees interns developers designers testers teamMembers teamLeadUser teamLeadEmployee teamLead teamLeadId")
      .lean();

    for (const team of teams) {
      const rawMemberIds = [
        ...(team.employees || []),
        ...(team.interns || []),
        ...(team.developers || []),
        ...(team.designers || []),
        ...(team.testers || []),
        ...(team.teamMembers || []),
      ].map(String).filter(Boolean);

      for (const memberId of rawMemberIds) {
        assignedUserIds.add(memberId);
        discoveredEmployeeIds.add(memberId);
        discoveredUserIds.add(memberId);
      }
    }
  } catch (_) {}

  // 2. Direct reporting in Employee collection
  try {
    const directMembers = await Employee.find({
      $or: [
        { teamLeadUser: { $in: [...leadUserObjectIds, ...Array.from(leadUserIds)] } },
        { teamLeadEmployee: { $in: [...leadEmployeeObjectIds, ...Array.from(leadEmployeeIds)] } },
        { teamLeadId: { $in: Array.from(leadIdentifiers) } },
        { teamLead: { $in: [...leadUserObjectIds, ...leadEmployeeObjectIds, ...Array.from(leadUserIds), ...Array.from(leadEmployeeIds)] } },
        { reportingTo: { $in: [...leadUserObjectIds, ...leadEmployeeObjectIds, ...Array.from(leadUserIds), ...Array.from(leadEmployeeIds)] } },
      ],
    }).select("_id userID userId email employeeID employeeCode teamLeadUser teamLeadEmployee teamLeadId").lean();

    for (const member of directMembers) {
      assignedUserIds.add(String(member._id));
      discoveredEmployeeIds.add(String(member._id));
      if (member.userID) {
        assignedUserIds.add(String(member.userID));
        discoveredUserIds.add(String(member.userID));
      }
      if (member.userId) {
        assignedUserIds.add(String(member.userId));
        discoveredUserIds.add(String(member.userId));
      }
      if (member.email) {
        discoveredEmails.add(String(member.email).toLowerCase().trim());
      }
    }
  } catch (_) {}

  // 3. Project and TeamMember assignments
  if (Project) {
    try {
      const projects = await Project.find({
        $or: [
          { teamLeadUser: { $in: [...leadUserObjectIds, ...Array.from(leadUserIds)] } },
          { teamLeadEmployee: { $in: [...leadEmployeeObjectIds, ...Array.from(leadEmployeeIds)] } },
          { teamLead: { $in: [...leadUserObjectIds, ...leadEmployeeObjectIds, ...Array.from(leadUserIds), ...Array.from(leadEmployeeIds)] } },
        ],
      }).select("employees interns").lean();

      for (const proj of projects) {
        for (const empId of (proj.employees || [])) {
          discoveredEmployeeIds.add(String(empId));
          assignedUserIds.add(String(empId));
        }
        for (const intId of (proj.interns || [])) {
          discoveredUserIds.add(String(intId));
          assignedUserIds.add(String(intId));
        }
      }
    } catch (_) {}
  }

  if (TeamMember) {
    try {
      const leadMemberships = await TeamMember.find({
        userId: { $in: [...leadUserObjectIds, ...Array.from(leadUserIds)] },
        role: { $in: ["Team Lead", "team lead", "teamlead", "Lead", "Project Manager"] },
      }).select("projectId").lean();

      const projectIds = leadMemberships.map((m) => m.projectId).filter(Boolean);
      if (projectIds.length > 0) {
        const peerMembers = await TeamMember.find({
          projectId: { $in: projectIds },
        }).select("userId").lean();
        for (const pm of peerMembers) {
          if (pm.userId) {
            discoveredUserIds.add(String(pm.userId));
            assignedUserIds.add(String(pm.userId));
          }
        }
      }
    } catch (_) {}
  }

  // 4. Bidirectional Cross-Resolution (Employee <-> User <-> Email)
  const allDiscoveredUserObjectIds = Array.from(discoveredUserIds)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const allDiscoveredEmployeeObjectIds = Array.from(discoveredEmployeeIds)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  // Query Users for discovered IDs or emails
  const userOrConditions = [];
  if (allDiscoveredUserObjectIds.length) {
    userOrConditions.push({ _id: { $in: allDiscoveredUserObjectIds } });
  }
  if (discoveredEmails.size) {
    userOrConditions.push({ email: { $in: Array.from(discoveredEmails) } });
  }
  if (userOrConditions.length) {
    try {
      const foundUsers = await User.find({ $or: userOrConditions }).select("_id email uniqueID").lean();
      for (const u of foundUsers) {
        assignedUserIds.add(String(u._id));
        discoveredUserIds.add(String(u._id));
        if (u.email) discoveredEmails.add(String(u.email).toLowerCase().trim());
      }
    } catch (_) {}
  }

  // Query Employees for discovered employee IDs, user IDs, or emails
  const empOrConditions = [];
  if (allDiscoveredEmployeeObjectIds.length) {
    empOrConditions.push({ _id: { $in: [...allDiscoveredEmployeeObjectIds, ...Array.from(discoveredEmployeeIds)] } });
  }
  if (allDiscoveredUserObjectIds.length) {
    empOrConditions.push({ userID: { $in: [...allDiscoveredUserObjectIds, ...Array.from(discoveredUserIds)] } });
    empOrConditions.push({ userId: { $in: [...allDiscoveredUserObjectIds, ...Array.from(discoveredUserIds)] } });
  }
  if (discoveredEmails.size) {
    empOrConditions.push({ email: { $in: Array.from(discoveredEmails) } });
  }
  if (empOrConditions.length) {
    try {
      const foundEmployees = await Employee.find({ $or: empOrConditions }).select("_id userID userId email").lean();
      for (const e of foundEmployees) {
        assignedUserIds.add(String(e._id));
        if (e.userID) {
          assignedUserIds.add(String(e.userID));
          discoveredUserIds.add(String(e.userID));
        }
        if (e.userId) {
          assignedUserIds.add(String(e.userId));
          discoveredUserIds.add(String(e.userId));
        }
        if (e.email) {
          discoveredEmails.add(String(e.email).toLowerCase().trim());
        }
      }
    } catch (_) {}
  }

  // Final lookup of Users if new emails were discovered from Employees
  if (discoveredEmails.size) {
    try {
      const finalUsers = await User.find({
        email: { $in: Array.from(discoveredEmails) },
      }).select("_id").lean();
      for (const u of finalUsers) {
        assignedUserIds.add(String(u._id));
      }
    } catch (_) {}
  }

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
      startDate,
      endDate,
      reason, 
    } = req.body;

    const authenticatedUserId = req.user?._id || req.user?.id;
    const suppliedIdentity =
      bodyUserId ||
      employeeId ||
      req.body.userID ||
      req.body.employeeID ||
      req.body.empId ||
      req.body.empID ||
      req.body.user_id ||
      req.body.employee_id ||
      req.body.targetUserId ||
      req.body.targetEmployeeId ||
      req.body.selectedEmployee ||
      req.body.selectedEmployeeId ||
      (typeof req.body.employee === "object" ? (req.body.employee?._id || req.body.employee?.id || req.body.employee?.employeeID) : req.body.employee) ||
      (typeof req.body.user === "object" ? (req.body.user?._id || req.body.user?.id) : req.body.user) ||
      req.query?.userId ||
      req.query?.employeeId ||
      null;

    if (!authenticatedUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let isAdminOrHr = isUserAdminOrHr(req.user);

    // Database lookup fallback if req.user role was not loaded as Admin or HR
    if (!isAdminOrHr && authenticatedUserId) {
      try {
        const userDoc = await User.findById(authenticatedUserId).select("role designation roles").lean();
        if (userDoc && isUserAdminOrHr(userDoc)) {
          isAdminOrHr = true;
          if (userDoc.role && req.user) req.user.role = userDoc.role;
        }
        if (!isAdminOrHr) {
          const FinanceUser = require("../models/FinanceUser");
          const finUser = await FinanceUser.findOne({ userId: authenticatedUserId }).lean();
          if (finUser && isUserAdminOrHr(finUser)) {
            isAdminOrHr = true;
          }
        }
      } catch (_) {}
    }

    const cleanApplier = normalizeRoleString(req.user?.role);
    const applierRole = isAdminOrHr
      ? (cleanApplier === "hr" ? "hr" : "admin")
      : cleanApplier;

    let targetUserId = authenticatedUserId;
    let user = null;

    if (isAdminOrHr && suppliedIdentity && String(suppliedIdentity) !== String(authenticatedUserId)) {
      // Admin or HR is creating leave on behalf of an employee
      const cleanIdentity = String(suppliedIdentity).trim();

      if (mongoose.Types.ObjectId.isValid(cleanIdentity)) {
        user = await User.findById(cleanIdentity);
        if (!user) {
          const emp = await Employee.findOne({
            $or: [
              { _id: cleanIdentity },
              { userID: cleanIdentity },
              { userId: cleanIdentity },
            ],
          });
          if (emp) {
            const actualUserId = emp.userID || emp.userId || emp._id;
            user = await User.findById(actualUserId);
            if (!user) {
              user = {
                _id: emp.userID || emp.userId || emp._id,
                role: (emp.role || emp.designation || "employee").toLowerCase(),
                name: [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(" ") || "Employee",
                email: emp.email,
                isApproved: true,
                isActive: true,
                companyId: emp.companyId || req.user?.companyId,
                branchId: emp.branchId || req.user?.branchId,
              };
            }
          }
        }
      }

      if (!user) {
        const emp = await Employee.findOne({
          $or: [
            { employeeID: cleanIdentity },
            { employeeCode: cleanIdentity },
            { email: cleanIdentity.toLowerCase() },
          ],
        });
        if (emp) {
          const actualUserId = emp.userID || emp.userId || emp._id;
          user = await User.findById(actualUserId);
          if (!user) {
            user = {
              _id: emp.userID || emp.userId || emp._id,
              role: (emp.role || emp.designation || "employee").toLowerCase(),
              name: [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(" ") || "Employee",
              email: emp.email,
              isApproved: true,
              isActive: true,
              companyId: emp.companyId || req.user?.companyId,
              branchId: emp.branchId || req.user?.branchId,
            };
          }
        } else {
          user = await User.findOne({
            $or: [
              { uniqueID: cleanIdentity },
              { email: cleanIdentity.toLowerCase() },
            ],
          });
        }
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Selected employee not found",
        });
      }

      targetUserId = user._id;
    } else {
      user = await User.findById(targetUserId);

      if (!user) {
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
              name: [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(" ") || "Employee",
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

      if (suppliedIdentity && !isAdminOrHr) {
        const cleanIdentity = String(suppliedIdentity).trim();
        const validObjectId = mongoose.Types.ObjectId.isValid(cleanIdentity);
        const targetEmployee = await Employee.findOne({
          $or: [
            ...(validObjectId ? [{ _id: cleanIdentity }, { userID: cleanIdentity }, { userId: cleanIdentity }] : []),
            { employeeID: cleanIdentity },
            { employeeCode: cleanIdentity },
          ],
        });
        const isSelf =
          cleanIdentity === String(authenticatedUserId) ||
          Boolean(
            targetEmployee &&
            String(targetEmployee.userID || targetEmployee.userId || "") === String(authenticatedUserId)
          );
        if (!isSelf) {
          return res.status(403).json({
            success: false,
            message: "You cannot apply for leave for another employee",
          });
        }
      }
    }

    const userId = user._id || targetUserId;

    const actualStartDate =
      startDate || req.body.startDate || req.body.leaveDate || req.body.date || req.body.fromDate;
    const actualEndDate = endDate || req.body.endDate || req.body.toDate || actualStartDate;
    const leaveDuration = normalizeLeaveDuration(req.body);
    const dateValidation = validateLeaveDateRange(
      actualStartDate,
      actualEndDate,
      leaveDuration.isHalfDay,
    );
    if (dateValidation.error) {
      return res.status(400).json({ success: false, message: dateValidation.error });
    }

    const todayStr = toDateString(new Date());
    const startStr = toDateString(actualStartDate);

    // Regular employees cannot apply for past dates
    if (!isAdminOrHr && startStr && startStr < todayStr) {
      return res.status(400).json({
        success: false,
        message: "Cannot apply for leave on past dates. Leave start date must be today or a future date.",
      });
    }

    const isHalfDayBool = leaveDuration.isHalfDay;
    const normalizedHalfDayType = leaveDuration.halfDayType;
    let normalizedLeaveType = leaveDuration.leaveType;
    if (!isHalfDayBool) {
      const validTypes = ["full_day", "sick", "paid", "unpaid"];
      if (normalizedLeaveType === "casual" || !validTypes.includes(normalizedLeaveType)) {
        normalizedLeaveType = "full_day";
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
    if (isHalfDayBool && workingDays !== 0.5) {
      return res.status(400).json({
        success: false,
        message: "Half-Day Leave can only be requested on a working day.",
      });
    }

    const totalDays = workingDays;

    // Check if leave balance is sufficient (only when totalDays > 0)
    const balance = await LeaveBalance.findOne({ employeeId: userId });
    if (!isAdminOrHr && balance && totalDays > 0 && balance.remainingLeaves < totalDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. Requested: ${totalDays} working days, Remaining: ${balance.remainingLeaves}`,
      });
    }

    const normalizedRole = String(user.role || applierRole || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const isEmployeeOrIntern = ["employee", "intern"].includes(normalizedRole);
    const hasAssignedTeamLead =
      !isEmployeeOrIntern || Boolean(await getTeamLeadForUser(userId));

    const isDirectApproved = isAdminOrHr && (
      req.body.status === "approved" ||
      req.body.autoApprove === true ||
      req.body.directApprove === true ||
      req.body.approvalStatus === "approved" ||
      (applierRole === "admin" && req.body.status !== "pending") ||
      (applierRole === "hr" && req.body.status !== "pending" && req.body.status !== "pending_admin")
    );

    let leaveStatus;
    let teamLeadStatus;
    let hrStatus;

    if (isDirectApproved) {
      leaveStatus = "approved";
      teamLeadStatus = "approved";
      hrStatus = "approved";
    } else {
      leaveStatus =
        user.role === "team lead" || applierRole === "team lead"
          ? "pending_hr"
          : isEmployeeOrIntern && !hasAssignedTeamLead
            ? "pending_hr"
            : user.role === "hr" || applierRole === "hr"
              ? "pending_admin"
              : "pending";
      teamLeadStatus =
        isAdminOrHr ||
        user.role === "team lead" ||
        applierRole === "team lead" ||
        user.role === "hr" ||
        (isEmployeeOrIntern && !hasAssignedTeamLead)
          ? "skipped"
          : "pending";
      hrStatus = applierRole === "hr" ? "approved" : "pending";
    }

    const applicantRole = ["employee", "intern", "team lead", "hr", "admin"].includes(String(user.role).toLowerCase())
      ? String(user.role).toLowerCase()
      : "employee";

    const leave = await Leave.create({
      employeeId: userId,
      applicantRole,
      leaveType: normalizedLeaveType,
      startDate: actualStartDate,
      endDate: actualEndDate,
      totalDays,
      isHalfDay: isHalfDayBool,
      halfDayType: normalizedHalfDayType,
      reason: reason || req.body.remark || (isAdminOrHr ? `Leave granted by ${applierRole.toUpperCase()}` : ""),
      status: leaveStatus,
      teamLeadStatus,
      hrStatus,
      attachment: req.body.attachment || "",
      ...(isDirectApproved ? {
        adminApprovedBy: req.user._id,
        adminApprovedAt: new Date(),
        hrApprovedBy: req.user._id,
        hrApprovedAt: new Date(),
        remark: req.body.remark || `Approved directly upon creation by ${applierRole.toUpperCase()}`,
        description: req.body.description || req.body.remark || `Approved directly upon creation by ${applierRole.toUpperCase()}`,
      } : {})
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

    if (isDirectApproved) {
      await updateLeaveBalance(leave);
    }

    const enrichedLeave = await enrichLeavesWithEmployeeDetails(leave);

    await recordAuditEvent({
      req,
      module: "LEAVE",
      action: "CREATE",
      actionType: isDirectApproved ? "LEAVE_CREATED_APPROVED" : "LEAVE_APPLIED",
      entityType: "Leave",
      entityId: leave._id,
      description: isAdminOrHr && String(userId) !== String(authenticatedUserId)
        ? `Leave created by ${applierRole.toUpperCase()} for ${user.name || 'Employee'} (${normalizedLeaveType}: ${actualStartDate} to ${actualEndDate})`
        : `Leave applied by ${user.name || 'User'} (${normalizedLeaveType}: ${actualStartDate} to ${actualEndDate})`,
      newValues: leave,
      companyId: user?.companyId || req.user?.companyId,
    });

    if (isDirectApproved && String(userId) !== String(authenticatedUserId)) {
      try {
        await notify({
          userId,
          type: "LEAVE_ADMIN_APPROVED",
          title: "Leave Granted by Admin/HR",
          message: `Leave has been granted for you by ${applierRole.toUpperCase()} from ${actualStartDate} to ${actualEndDate}.`,
          meta: {
            leaveId: leave._id.toString(),
            status: "approved",
            stage: applierRole.toLowerCase(),
            reason: leave.reason,
          },
        });
      } catch (_) {}
    }

    res.status(201).json({
      success: true,
      message: isDirectApproved
        ? "Leave request created and approved successfully"
        : (isAdminOrHr && String(userId) !== String(authenticatedUserId))
          ? "Leave request created successfully for employee"
          : "Leave request sent successfully",
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
    const normalizedRole = normalizeRoleString(role);

    let filter = {};

    let isTL = normalizedRole === "teamlead";
    if (!isTL && _id) {
      isTL = await isUserTeamLead(req.user, _id);
    }

    if (isTL) {
      const assignedUserIds = await getTeamLeadAssignedUserIds(_id);
      filter = {
        employeeId: { $in: assignedUserIds },
        applicantRole: { $ne: "hr" },
      };
    } else if (normalizedRole === "employee" || normalizedRole === "intern") {
      filter = { employeeId: _id };
    } else if (normalizedRole === "hr") {
      filter = { applicantRole: { $ne: "hr" } };
    } else if (normalizedRole === "admin") {
      filter = {};
    } else {
      return res.status(403).json({
        success: false,
        message: `Role "${role}" is not authorized to view leaves.`,
      });
    }

    if (req.query.status && req.query.status !== "all") {
      filter.status = req.query.status;
    }
    if (req.query.leaveType && req.query.leaveType !== "all") {
      filter.leaveType = req.query.leaveType;
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
      leaves: enrichedLeaves,
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

    const isTL = await isUserTeamLead(user || req.user, userId);

    if (!isTL) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Team Leads can view pending leaves.",
      });
    }

    const assignedUserIds = await getTeamLeadAssignedUserIds(userId);
    const leaves = await Leave.find({
      applicantRole: { $ne: "hr" },
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
      leaves: enrichedLeaves,
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

exports.teamLeadApproval = async (req, res) => {
  try {
    const { leaveId: bodyLeaveId, status: bodyStatus, remark, description } = req.body || {};
    const leaveId = bodyLeaveId || req.params.id || req.params.leaveId || req.query.leaveId;

    let status = bodyStatus;
    if (!status) {
      const path = (req.originalUrl || req.path || "").toLowerCase();
      if (path.includes("/reject")) {
        status = "rejected";
      } else if (path.includes("/approve")) {
        status = "approved";
      }
    }

    const remarkText = (remark || description || (status === "approved" ? "Approved by Team Lead" : "")).trim();

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

    // Check: Team Lead cannot approve their OWN leave
    const leaveEmployeeId = String(
      (leave.employeeId && typeof leave.employeeId === "object" && leave.employeeId._id)
        ? leave.employeeId._id
        : leave.employeeId || ""
    );
    const authenticatedUserId = String(req.user?._id || req.user?.id || "");

    if (leaveEmployeeId && authenticatedUserId && leaveEmployeeId === authenticatedUserId) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot approve your own leave. It will be directly processed by HR.",
      });
    }

    // Check if this is an employee/intern leave (not HR or Admin)
    const applicantRole = String(
      leave.applicantRole ||
      (typeof leave.employeeId === "object" ? leave.employeeId?.role : "") ||
      "employee"
    ).toLowerCase().trim().replace(/[_s-]+/g, "");

    if (applicantRole === "hr" || applicantRole === "admin" || applicantRole === "superadmin") {
      return res.status(400).json({
        success: false,
        message: "Team Lead can only approve employee/intern leaves",
      });
    }

    if (leave.teamLeadStatus && leave.teamLeadStatus !== "pending") {
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

    const oldLeaveData = leave.toObject ? leave.toObject() : { ...leave };
    await leave.save();
    await recordAuditEvent({
      req,
      module: "LEAVE",
      action: status === "approved" ? "APPROVE" : "REJECT",
      actionType: status === "approved" ? "LEAVE_TL_APPROVED" : "LEAVE_TL_REJECTED",
      entityType: "Leave",
      entityId: leave._id,
      description: `Leave ${status} by Team Lead: ${remarkText}`,
      oldValues: oldLeaveData,
      newValues: leave,
      companyId: leave.companyId || req.user?.companyId,
    });
    await notifyLeaveDecision(leave, "TEAM_LEAD", status, remarkText);

    const enrichedLeave = await enrichLeavesWithEmployeeDetails(leave);

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Leave approved by team lead and forwarded to HR"
          : "Leave rejected by team lead",
      data: enrichedLeave,
    });
  } catch (error) {
    console.error("Team Lead Approval Error:", error);
    return res.status(500).json({
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

    const oldLeaveData = leave.toObject ? leave.toObject() : { ...leave };
    await leave.save();
    await recordAuditEvent({
      req,
      module: "LEAVE",
      action: status === "approved" ? "APPROVE" : "REJECT",
      actionType: status === "approved" ? "LEAVE_HR_APPROVED" : "LEAVE_HR_REJECTED",
      entityType: "Leave",
      entityId: leave._id,
      description: `Leave ${status} by HR: ${remarkText}`,
      oldValues: oldLeaveData,
      newValues: leave,
      companyId: leave.companyId || req.user?.companyId,
    });
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

    const oldLeaveData = leave.toObject ? leave.toObject() : { ...leave };
    await leave.save();
    await recordAuditEvent({
      req,
      module: "LEAVE",
      action: status === "approved" ? "APPROVE" : "REJECT",
      actionType: status === "approved" ? "LEAVE_ADMIN_APPROVED" : "LEAVE_ADMIN_REJECTED",
      entityType: "Leave",
      entityId: leave._id,
      description: `Leave ${status} by Admin: ${remarkText}`,
      oldValues: oldLeaveData,
      newValues: leave,
      companyId: leave.companyId || req.user?.companyId,
    });
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
    const { startDate, endDate } = req.body;
    const actualStartDate = startDate || req.body.leaveDate || req.body.date || req.body.fromDate;
    const actualEndDate = endDate || req.body.toDate || actualStartDate;
    const leaveDuration = normalizeLeaveDuration(req.body);
    const dateValidation = validateLeaveDateRange(
      actualStartDate,
      actualEndDate,
      leaveDuration.isHalfDay,
    );
    if (dateValidation.error) {
      return res.status(400).json({ success: false, message: dateValidation.error });
    }

    const calculation = await calculateWorkingLeaveDays(
      actualStartDate,
      actualEndDate,
      leaveDuration.isHalfDay,
    );
    if (leaveDuration.isHalfDay && calculation.workingDays !== 0.5) {
      return res.status(400).json({
        success: false,
        message: "Half-Day Leave can only be requested on a working day.",
        data: calculation,
      });
    }

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
