const mongoose = require("mongoose");
const Notification = require("../models/notification");
const Announcement = require("../models/announcement");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const AdjustmentRequest = require("../models/AdjustmentRequest");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Department = require("../models/Department");
const { sendPushNotification } = require("../services/fcm.service");

const getCompanyScope = (user) => {
  const companyIds = [
    user?.companyId,
    ...(Array.isArray(user?.companyAccess)
      ? user.companyAccess.filter((access) => access?.isActive !== false).map((access) => access.companyId)
      : []),
  ].filter((companyId) => companyId && mongoose.isValidObjectId(companyId));
  const uniqueCompanyIds = [...new Set(companyIds.map((companyId) => String(companyId)))];
  return uniqueCompanyIds.length ? { companyId: { $in: uniqueCompanyIds } } : {};
};

const getActiveEmployeeQuery = (companyScope = {}) => ({
  ...companyScope,
  isDeactivated: { $ne: true },
  employeeStatus: { $nin: ["Inactive", "INACTIVE", "Resigned", "Terminated", "TERMINATED"] },
});

const resolveAnnouncementRecipients = async ({ targetType, targetRole, targetUserIds, targetDepartmentIds, user }) => {
  const normalizedType = String(targetType || "ALL").toUpperCase();
  const companyScope = getCompanyScope(user);

  if (normalizedType === "PERSON") {
    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0 ||
      targetUserIds.some((id) => !mongoose.isValidObjectId(id))) {
      throw Object.assign(new Error("Select at least one valid employee"), { statusCode: 400 });
    }
    const employees = await Employee.find({
      ...getActiveEmployeeQuery(companyScope),
      $or: [
        { userID: { $in: targetUserIds } },
        { userId: { $in: targetUserIds } },
      ],
    }).select("userID userId email").lean();
    const recipients = await resolveUsersForEmployees(employees);
    if (recipients.length !== new Set(targetUserIds.map(String)).size) {
      throw Object.assign(new Error("One or more selected employees are unavailable"), { statusCode: 400 });
    }
    return recipients;
  }

  if (normalizedType === "DEPARTMENT") {
    if (!Array.isArray(targetDepartmentIds) || targetDepartmentIds.length === 0 ||
      targetDepartmentIds.some((id) => !mongoose.isValidObjectId(id))) {
      throw Object.assign(new Error("Select at least one valid department"), { statusCode: 400 });
    }

    const departments = await Department.find({
      _id: { $in: targetDepartmentIds },
      isActive: { $ne: false },
      status: { $ne: false },
      ...companyScope,
    }).select("_id departmentName name").lean();

    if (departments.length !== new Set(targetDepartmentIds.map(String)).size) {
      throw Object.assign(new Error("One or more selected departments are unavailable"), { statusCode: 400 });
    }

    const departmentNames = departments
      .flatMap((department) => [department.departmentName, department.name])
      .filter(Boolean);
    const employees = await Employee.find({
      ...getActiveEmployeeQuery(companyScope),
      $or: [
        { departmentId: { $in: departments.map((department) => department._id) } },
        { department: { $in: departmentNames } },
      ],
    }).select("userID userId email").lean();

    return resolveUsersForEmployees(employees);
  }

  if (normalizedType === "ROLE") {
    const role = String(targetRole || "").trim();
    if (!role || role.toUpperCase() === "ALL") {
      throw Object.assign(new Error("Select a valid role"), { statusCode: 400 });
    }
    const roleRegex = new RegExp(`^${role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    return User.find({ role: roleRegex }).select("_id role deviceToken").lean();
  }

  if (normalizedType !== "ALL") {
    throw Object.assign(new Error("Unsupported announcement audience"), { statusCode: 400 });
  }

  return User.find({}).select("_id role deviceToken").lean();
};

const resolveUsersForEmployees = async (employees) => {
  const userIds = [...new Set(employees.flatMap((employee) => [employee.userID, employee.userId])
    .filter((userId) => userId && mongoose.isValidObjectId(userId))
    .map(String))];
  const emails = [...new Set(employees.map((employee) => String(employee.email || "").trim().toLowerCase()).filter(Boolean))];
  const query = [];
  if (userIds.length) query.push({ _id: { $in: userIds } });
  if (emails.length) query.push({ email: { $in: emails } });
  if (!query.length) return [];

  const users = await User.find({ $or: query }).select("_id role email deviceToken").lean();
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const userByEmail = new Map(
    users.filter((user) => user.email).map((user) => [String(user.email).trim().toLowerCase(), user])
  );
  return [...new Map(employees.map((employee) => {
    const linkedId = employee.userID || employee.userId;
    const user = (linkedId && userById.get(String(linkedId))) ||
      userByEmail.get(String(employee.email || "").trim().toLowerCase());
    return user ? [String(user._id), user] : null;
  }).filter(Boolean)).values()];
};

// ===============================
// CREATE NOTIFICATION
// ===============================
exports.createNotification = async (req, res) => {
  try {
    const notification = await Notification.create({
      ...req.body,
      userId: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// GET ADMIN NOTIFICATIONS (UNIFIED FEED)
// ===============================
exports.getAdminNotifications = async (req, res) => {
  try {
    // 1. Fetch DB notifications
    const dbNotifications = await Notification.find()
      .populate("userId", "name email role")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // 2. Fetch pending leave requests
    const pendingLeaves = await Leave.find({
      status: { $in: ["pending", "pending_admin", "pending_hr"] },
    })
      .populate("employeeId", "name email role employeeID")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // 3. Fetch pending check-in requests
    const pendingCheckIns = await Attendance.find({
      approvalStatus: "pending",
      checkInTime: { $ne: null },
    })
      .populate("userId", "name email role")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // 4. Fetch pending adjustment requests
    let pendingAdjustments = [];
    try {
      pendingAdjustments = await AdjustmentRequest.find({
        status: "pending",
      })
        .populate("userId", "name email role")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    } catch (e) {
      console.log("AdjustmentRequest fetch skipped:", e.message);
    }

    // 5. Fetch announcements
    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Transform into unified notification items
    const feed = [];

    // A broadcast announcement is stored once per recipient so each user has
    // an independent read state. Show it once in the shared admin feed.
    const notificationFeedItems = [];
    const announcementGroups = new Map();
    dbNotifications.forEach((notification) => {
      const announcementId =
        notification.type === "ANNOUNCEMENT" &&
        (notification.meta?.announcementId || notification.metaData?.announcementId);

      if (!announcementId) {
        notificationFeedItems.push({
          notification,
          recipientCount: 1,
          allRecipientsRead: Boolean(notification.isRead || notification.read),
          notificationIds: [notification._id],
        });
        return;
      }

      const key = String(announcementId);
      const existingGroup = announcementGroups.get(key);
      if (existingGroup) {
        existingGroup.recipientCount += 1;
        existingGroup.allRecipientsRead =
          existingGroup.allRecipientsRead && Boolean(notification.isRead || notification.read);
        existingGroup.notificationIds.push(notification._id);
        return;
      }

      const group = {
        notification,
        recipientCount: 1,
        allRecipientsRead: Boolean(notification.isRead || notification.read),
        notificationIds: [notification._id],
      };
      announcementGroups.set(key, group);
      notificationFeedItems.push(group);
    });

    // Add DB notifications
    notificationFeedItems.forEach(({ notification: n, recipientCount, allRecipientsRead, notificationIds }) => {
      feed.push({
        _id: n._id,
        id: n._id,
        title: n.title,
        message: n.message,
        type: n.type || "SYSTEM",
        category: n.type === "ANNOUNCEMENT" ? "announcement" : "system",
        isRead: allRecipientsRead,
        createdAt: n.createdAt,
        user: n.type === "ANNOUNCEMENT"
          ? null
          : n.userId ? { name: n.userId.name, email: n.userId.email } : null,
        ...(n.type === "ANNOUNCEMENT" && recipientCount > 1
          ? { recipientCount, notificationIds }
          : {}),
        link: n.metaData?.link || "/dashboard",
      });
    });

    // Add Pending Leaves
    pendingLeaves.forEach((l) => {
      const applicantName = l.employeeId?.name || "Employee";
      feed.push({
        _id: `leave_${l._id}`,
        id: `leave_${l._id}`,
        rawId: l._id,
        title: "New Leave Application",
        message: `${applicantName} applied for ${l.leaveType} leave (${l.totalDays} day${l.totalDays > 1 ? "s" : ""})`,
        type: "LEAVE_REQUEST",
        category: "request",
        isRead: false,
        createdAt: l.createdAt,
        user: l.employeeId ? { name: l.employeeId.name, email: l.employeeId.email } : null,
        link: "/attendance/leave-request",
      });
    });

    // Add Pending Check-ins
    pendingCheckIns.forEach((c) => {
      const empName = c.userId?.name || "Employee";
      const timeStr = c.checkInTime ? new Date(c.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
      feed.push({
        _id: `checkin_${c._id}`,
        id: `checkin_${c._id}`,
        rawId: c._id,
        title: "Check-In Approval Request",
        message: `${empName} requested check-in approval (${c.date} ${timeStr})`,
        type: "CHECKIN_REQUEST",
        category: "request",
        isRead: false,
        createdAt: c.checkInTime || c.createdAt,
        user: c.userId ? { name: c.userId.name, email: c.userId.email } : null,
        link: "/attendance/check-in-request",
      });
    });

    // Add Pending Adjustments
    pendingAdjustments.forEach((adj) => {
      const empName = adj.userId?.name || "Employee";
      feed.push({
        _id: `adj_${adj._id}`,
        id: `adj_${adj._id}`,
        rawId: adj._id,
        title: "Attendance Adjustment Request",
        message: `${empName} requested attendance adjustment for ${adj.date || "recent date"}`,
        type: "ADJUSTMENT_REQUEST",
        category: "request",
        isRead: false,
        createdAt: adj.createdAt,
        user: adj.userId ? { name: adj.userId.name, email: adj.userId.email } : null,
        link: "/attendance/adjustments",
      });
    });

    // Sort all by date descending
    feed.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // Calculate unread count
    const unreadCount = feed.filter((item) => !item.isRead).length;

    return res.status(200).json({
      success: true,
      unreadCount,
      totalCount: feed.length,
      data: feed,
      announcements,
    });
  } catch (error) {
    console.error("Get Admin Notifications Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// MARK AS READ
// ===============================
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (id && !id.startsWith("leave_") && !id.startsWith("checkin_") && !id.startsWith("adj_")) {
      const notification = await Notification.findOne({ _id: id, userId: req.user._id }).select("type meta metaData");
      const announcementId =
        notification?.type === "ANNOUNCEMENT" &&
        (notification.meta?.announcementId || notification.metaData?.announcementId);

      if (announcementId) {
        await Notification.updateMany(
          {
            userId: req.user._id,
            type: "ANNOUNCEMENT",
            $or: [
              { "meta.announcementId": announcementId },
              { "metaData.announcementId": announcementId },
            ],
          },
          { $set: { read: true, isRead: true, readAt: new Date() } }
        );
      } else {
        await Notification.findOneAndUpdate({ _id: id, userId: req.user._id }, {
          $set: { read: true, isRead: true, readAt: new Date() },
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// MARK ALL AS READ
// ===============================
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { $set: { isRead: true, read: true, readAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// DELETE NOTIFICATION
// =============================== 
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (id && !id.startsWith("leave_") && !id.startsWith("checkin_") && !id.startsWith("adj_")) {
      await Notification.findOneAndDelete({ _id: id, userId: req.user._id });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// DELETE ALL NOTIFICATIONS
// ===============================
exports.deleteAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ userId: req.user._id });

    return res.status(200).json({
      success: true,
      message: "All notifications deleted for user",
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// UPDATE ANNOUNCEMENT
// ===============================
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Announcement updated successfully",
      data: announcement,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// DELETE ANNOUNCEMENT
// ===============================
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findByIdAndDelete(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Announcement deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// GET USER NOTIFICATIONS
// ===============================
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    if (req.params.userId !== userId) {
      return res.status(403).json({ success: false, message: "You can only view your own notifications" });
    }
    const user = await User.findById(userId).select("role");

    const notifications = await Notification.find({
      $or: [
        { userId },
        { userId: null, type: "ANNOUNCEMENT" },
      ],
    }).sort({ createdAt: -1 });

    const normalizedRole = String(user?.role || "").toLowerCase().replace(/[\s_-]+/g, "");
    const seenAnnouncements = new Set();
    const visibleNotifications = notifications.filter((notification) => {
      if (notification.type !== "ANNOUNCEMENT") return true;
      const meta = notification.meta || notification.metaData || {};
      const announcementId = meta.announcementId || notification._id;
      if (seenAnnouncements.has(String(announcementId))) return false;
      seenAnnouncements.add(String(announcementId));

      if (notification.userId) return true;

      const targetRole = String(meta.targetRole || "ALL").toLowerCase().replace(/[\s_-]+/g, "");
      if (targetRole !== "all" && targetRole !== normalizedRole) return false;
      return true;
    });

    return res.status(200).json({
      success: true,
      data: visibleNotifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// CREATE ANNOUNCEMENT
// ===============================
exports.getAnnouncementRecipients = async (req, res) => {
  try {
    const companyScope = getCompanyScope(req.user);
    const [employees, departments] = await Promise.all([
      Employee.find(getActiveEmployeeQuery(companyScope))
        .select("userID userId email name firstName middleName lastName department departmentId")
        .lean(),
      Department.find({
        isActive: { $ne: false },
        status: { $ne: false },
        ...companyScope,
      }).select("_id departmentName name").sort({ departmentName: 1 }).lean(),
    ]);
    const users = await resolveUsersForEmployees(employees);
    const usersById = new Map(users.map((user) => [String(user._id), user]));
    const departmentNames = new Set(
      employees.map((employee) => String(employee.department || "").trim().toLowerCase()).filter(Boolean)
    );
    const availableDepartments = departments
      .filter((department) =>
        departmentNames.has(String(department.departmentName || department.name || "").trim().toLowerCase()) ||
        employees.some((employee) => String(employee.departmentId) === String(department._id))
      )
      .map((department) => ({
        id: String(department._id),
        name: department.departmentName || department.name,
      }));

    const recipients = employees.flatMap((employee) => {
      const linkedId = employee.userID || employee.userId;
      const user = (linkedId && usersById.get(String(linkedId))) ||
        users.find((item) => String(item.email || "").toLowerCase() === String(employee.email || "").toLowerCase());
      if (!user) return [];
      const name = employee.name ||
        [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ") ||
        user.name ||
        user.email;
      return [{
        id: String(user._id),
        name,
        email: user.email || employee.email,
        department: employee.department || "",
      }];
    });

    return res.status(200).json({
      success: true,
      data: {
        employees: [...new Map(recipients.map((recipient) => [recipient.id, recipient])).values()],
        departments: availableDepartments,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const targetRole = String(req.body.targetRole || "ALL").trim();
    const targetType = String(
      req.body.targetType || (targetRole.toUpperCase() === "ALL" ? "ALL" : "ROLE")
    ).toUpperCase();
    const recipients = await resolveAnnouncementRecipients({
      targetType,
      targetRole,
      targetUserIds: req.body.targetUserIds,
      targetDepartmentIds: req.body.targetDepartmentIds,
      user: req.user,
    });
    if (!recipients.length) {
      return res.status(400).json({ success: false, message: "No active recipients found for this audience" });
    }

    const announcement = await Announcement.create({
      title: req.body.title,
      message: req.body.message,
      type: req.body.type || "ANNOUNCEMENT",
      targetType,
      targetRole,
      targetUserIds: targetType === "PERSON" ? req.body.targetUserIds : [],
      targetDepartmentIds: targetType === "DEPARTMENT" ? req.body.targetDepartmentIds : [],
      companyId: req.user.companyId || null,
    });

    await Promise.all(recipients.map((recipient) => Notification.create({
      userId: recipient._id,
      companyId: announcement.companyId,
      type: "ANNOUNCEMENT",
      channel: "IN_APP",
      title: announcement.title,
      message: announcement.message,
      read: false,
      meta: {
        announcementId: announcement._id.toString(),
        status: announcement.isActive === false ? "inactive" : "published",
        targetRole: announcement.targetRole || "ALL",
        targetType,
      },
    })));

    const pushResults = await Promise.allSettled(
      recipients
        .filter((user) => user.deviceToken)
        .map((user) =>
          sendPushNotification({
            deviceToken: user.deviceToken,
            title: announcement.title,
            body: announcement.message,
            data: {
              type: "ANNOUNCEMENT",
              announcementId: announcement._id.toString(),
            },
          })
        )
    );
    pushResults.forEach((result) => {
      if (result.status === "rejected") {
        console.error("[Announcement Push Error]:", result.reason.message);
      }
    });

    return res.status(201).json({
      success: true,
      message: "Announcement created",
      data: announcement,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// GET ALL ANNOUNCEMENTS
// ===============================
exports.getAnnouncements = async (req, res) => {
  try {
    const rawData = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    const userId = String(req.user._id);
    const normalizedRole = String(req.user.role || "").toLowerCase().replace(/[\s_-]+/g, "");
    const employee = await Employee.findOne({
      $or: [
        { userID: req.user._id },
        { userId: req.user._id },
        { email: String(req.user.email || "").trim().toLowerCase() },
      ],
      ...getActiveEmployeeQuery(getCompanyScope(req.user)),
    }).select("department departmentId").lean();
    const departmentIds = new Set((employee?.departmentId ? [String(employee.departmentId)] : []));
    const departmentNames = new Set(
      employee?.department ? [String(employee.department).trim().toLowerCase()] : []
    );
    const targetDepartmentIds = [...new Set(rawData.flatMap((announcement) =>
      (announcement.targetDepartmentIds || []).map(String)
    ))];
    const targetDepartments = targetDepartmentIds.length
      ? await Department.find({ _id: { $in: targetDepartmentIds } })
        .select("_id departmentName name").lean()
      : [];
    const departmentNameById = new Map(targetDepartments.map((department) => [
      String(department._id),
      String(department.departmentName || department.name || "").trim().toLowerCase(),
    ]));

    const visibleAnnouncements = rawData.filter((announcement) => {
      const targetType = String(
        announcement.targetType ||
        (String(announcement.targetRole || "ALL").toUpperCase() === "ALL" ? "ALL" : "ROLE")
      ).toUpperCase();

      if (targetType === "PERSON") {
        return (announcement.targetUserIds || []).some((id) => String(id) === userId);
      }
      if (targetType === "DEPARTMENT") {
        return (announcement.targetDepartmentIds || []).some((id) =>
          departmentIds.has(String(id)) || departmentNames.has(departmentNameById.get(String(id)))
        );
      }
      if (targetType === "ROLE") {
        return String(announcement.targetRole || "").toLowerCase().replace(/[\s_-]+/g, "") === normalizedRole;
      }
      if (announcement.targetType) return targetType === "ALL";

      const legacyRole = String(announcement.targetRole || "ALL").toLowerCase().replace(/[\s_-]+/g, "");
      return legacyRole === "all" || legacyRole === normalizedRole ||
        (departmentNames.size > 0 && departmentNames.has(legacyRole));
    });

    const data = visibleAnnouncements.map((item) => {
      const createdDate = item.createdAt ? new Date(item.createdAt) : new Date();
      const istTime = createdDate.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const istDate = createdDate.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      return {
        ...item,
        time: istTime,
        displayTime: istTime,
        formattedTime: istTime,
        formattedDate: istDate,
        createdAtIST: `${istDate}, ${istTime}`,
      };
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// REGISTER DEVICE TOKEN (FCM)
// ===============================
exports.registerDeviceToken = async (req, res) => {
  try {
    const { token, deviceType } = req.body;

    if (!token || typeof token !== "string" || token.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "FCM device token is required",
      });
    }

    const trimmedToken = token.trim();
    const type = deviceType ? String(deviceType).trim().toLowerCase() : "android";
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - User not identified",
      });
    }

    // 1. Check if token already exists for this user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.notificationTokens) {
      user.notificationTokens = [];
    }

    const existingTokenIndex = user.notificationTokens.findIndex(
      (item) => item.token === trimmedToken
    );

    if (existingTokenIndex !== -1) {
      // Update existing token's updatedAt and deviceType
      user.notificationTokens[existingTokenIndex].updatedAt = new Date();
      if (deviceType) {
        user.notificationTokens[existingTokenIndex].deviceType = type;
      }
    } else {
      // Add new token
      user.notificationTokens.push({
        token: trimmedToken,
        deviceType: type,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await user.save();

    console.log(`📱 [FCM] Device token registered for user: ${user.name || user.email} (${type})`);

    return res.status(200).json({
      success: true,
      message: "Notification token registered successfully",
    });
  } catch (error) {
    console.error("❌ [FCM] registerDeviceToken error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to register notification token",
    });
  }
};

// ===============================
// REMOVE DEVICE TOKEN (FCM)
// ===============================
exports.removeDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== "string" || token.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "FCM device token is required",
      });
    }

    const trimmedToken = token.trim();
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - User not identified",
      });
    }

    await User.findByIdAndUpdate(userId, {
      $pull: {
        notificationTokens: { token: trimmedToken },
      },
    });

    console.log(`📱 [FCM] Device token removed for user ID: ${userId}`);

    return res.status(200).json({
      success: true,
      message: "Notification token removed successfully",
    });
  } catch (error) {
    console.error("❌ [FCM] removeDeviceToken error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to remove notification token",
    });
  }
};