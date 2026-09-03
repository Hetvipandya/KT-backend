const User = require("../models/User");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Session = require("../models/Session");
const Screenshot = require("../models/Screenshot");
const MonitoringSettings = require("../models/MonitoringSettings");
const InactivityEvent = require("../models/InactivityEvent");
const TaskManagement = require("../models/TaskManagement");
const DailyReport = require("../models/DailyReport");
const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const Holiday = require("../models/Holiday");
const Notification = require("../models/notification");
const Project = require("../models/Project");
const crypto = require("crypto");

// Helper for IST Today Date String (YYYY-MM-DD)
const getTodayIST = () => {
  const date = new Date();
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 5.5 * 60 * 60000);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const day = String(istDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ============================================================
// 1. DASHBOARD - EMPLOYEE OVERVIEW
// ============================================================
exports.getEmployeeDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = getTodayIST();

    // 1. Employee Info
    const user = await User.findById(userId).select("-password -plainPassword");
    const employee = await Employee.findOne({ userId });

    const employeeInfo = {
      userId: user._id,
      employeeID: user.uniqueID || employee?.employeeID || "",
      name: user.name,
      email: user.email,
      mobile: user.phoneNumber || employee?.mobile || "",
      designation: user.designation || employee?.designation || user.role,
      gender: user.gender || employee?.gender || "",
      department: user.department || employee?.department || "",
      joiningDate: employee?.joiningDate || user.createdAt,
      profilePhoto: employee?.profileImage || "",
    };

    // 2. Today's Attendance State
    let attendance = await Attendance.findOne({ userId, date: today });
    let currentSession = await Session.findOne({ userId, status: { $in: ["active", "break"] } }).sort({ createdAt: -1 });

    let attendanceStatus = "not_checked_in";
    let checkInTime = null;
    let currentWorkingHours = 0;
    let breakDuration = 0;
    let expectedCheckOutTime = null;
    let actionsAvailable = ["check_in"];

    if (attendance) {
      checkInTime = attendance.checkInTime || attendance.approvedCheckInTime;
      breakDuration = attendance.totalBreakTime || 0;
      currentWorkingHours = attendance.totalWorkTime || 0;

      const hasActiveBreak = attendance.breaks?.some((b) => !b.endTime);

      if (attendance.checkOutTime) {
        attendanceStatus = "checked_out";
        actionsAvailable = [];
      } else if (hasActiveBreak || (currentSession && currentSession.status === "break")) {
        attendanceStatus = "on_break";
        actionsAvailable = ["end_break"];
      } else if (checkInTime) {
        attendanceStatus = "active";
        actionsAvailable = ["start_break", "check_out"];

        // Expected checkout time = checkInTime + 8 hours + breakDuration minutes
        const checkInDate = new Date(checkInTime);
        const expectedMs = checkInDate.getTime() + 8 * 60 * 60 * 1000 + breakDuration * 60 * 1000;
        expectedCheckOutTime = new Date(expectedMs);
      } else if (attendance.approvalStatus === "pending") {
        attendanceStatus = "pending_approval";
        actionsAvailable = [];
      }
    }

    // 3. Dashboard Statistics
    const assignedTasks = await TaskManagement.find({ assignedEmployee: userId });
    const totalAssignedTasks = assignedTasks.length;
    const tasksInProgress = assignedTasks.filter((t) => t.status === "In Progress").length;
    const completedTasks = assignedTasks.filter((t) => t.status === "Completed").length;
    const pendingTasks = assignedTasks.filter((t) => t.status === "Pending" || t.status === "Assigned").length;

    let leaveBalanceDoc = await LeaveBalance.findOne({ employeeId: userId });
    const remainingLeave = leaveBalanceDoc ? leaveBalanceDoc.remainingLeaves : 20;

    // 4. Upcoming Birthdays (all employees)
    const allUsers = await User.find({ isActive: true }).select("_id name dob role department");
    const allEmployees = await Employee.find().select("userId profileImage designation dob");
    const employeeMap = new Map();
    allEmployees.forEach((e) => {
      if (e.userId) employeeMap.set(e.userId.toString(), e);
    });

    const now = new Date();
    const upcomingBirthdays = [];

    allUsers.forEach((u) => {
      const empData = employeeMap.get(u._id.toString());
      const dobVal = u.dob || empData?.dob;
      if (dobVal) {
        const dobDate = new Date(dobVal);
        if (!isNaN(dobDate.getTime())) {
          const birthdayThisYear = new Date(now.getFullYear(), dobDate.getMonth(), dobDate.getDate());
          if (birthdayThisYear < now) {
            birthdayThisYear.setFullYear(now.getFullYear() + 1);
          }
          const diffDays = Math.ceil((birthdayThisYear - now) / (1000 * 60 * 60 * 24));
          if (diffDays <= 60) {
            upcomingBirthdays.push({
              name: u.name,
              designation: empData?.designation || u.role,
              profilePhoto: empData?.profileImage || "",
              birthdayDate: birthdayThisYear,
              daysRemaining: diffDays,
            });
          }
        }
      }
    });

    upcomingBirthdays.sort((a, b) => a.daysRemaining - b.daysRemaining);

    // 5. Upcoming Holidays
    const holidays = await Holiday.find({ holidayDate: { $gte: new Date(now.setHours(0, 0, 0, 0)) } })
      .sort({ holidayDate: 1 })
      .limit(10);

    const upcomingHolidays = holidays.map((h) => {
      const hDate = new Date(h.holidayDate);
      const daysRem = Math.ceil((hDate - new Date()) / (1000 * 60 * 60 * 24));
      return {
        holidayName: h.holidayName,
        date: h.holidayDate,
        day: hDate.toLocaleDateString("en-US", { weekday: "long" }),
        daysRemaining: Math.max(0, daysRem),
      };
    });

    // 6. Team Members on Leave
    const todayLeaves = await Leave.find({
      status: "approved",
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date(now.setHours(0, 0, 0, 0)) },
    }).populate("employeeId", "name role department");

    const teamOnLeave = todayLeaves.map((l) => {
      const empData = l.employeeId ? employeeMap.get(l.employeeId._id.toString()) : null;
      return {
        name: l.employeeId?.name || "Employee",
        designation: empData?.designation || l.employeeId?.role || "",
        profilePhoto: empData?.profileImage || "",
        leaveType: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        numberOfDays: l.totalDays,
      };
    });

    // 7. My Leave Summary
    const myLeaves = await Leave.find({ employeeId: userId });
    const totalLeave = leaveBalanceDoc ? leaveBalanceDoc.totalLeaves : 20;
    const usedLeave = leaveBalanceDoc ? leaveBalanceDoc.usedLeaves : 0;
    const pendingRequests = myLeaves.filter((l) => l.status.includes("pending")).length;
    const upcomingApprovedLeave = myLeaves.filter((l) => l.status === "approved" && new Date(l.startDate) > new Date()).length;

    return res.status(200).json({
      success: true,
      data: {
        employeeInfo,
        todayAttendance: {
          status: attendanceStatus,
          checkInTime,
          currentWorkingHours,
          breakDuration,
          expectedCheckOutTime,
          actionsAvailable,
          sessionId: currentSession?.sessionId || attendance?.sessionId || null,
        },
        statistics: {
          todayWorkingHours: currentWorkingHours,
          totalAssignedTasks,
          tasksInProgress,
          completedTasks,
          pendingTasks,
          remainingLeave,
        },
        upcomingBirthdays: upcomingBirthdays.slice(0, 5),
        upcomingHolidays,
        teamMembersOnLeave: teamOnLeave,
        leaveSummary: {
          totalLeave,
          usedLeave,
          remainingLeave,
          pendingRequests,
          upcomingApprovedLeave,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 2. ATTENDANCE MANAGEMENT & TIMELINE (WITH COLOR RULES & HALF-DAY)
// ============================================================
exports.getEmployeeAttendanceTimeline = async (req, res) => {
  try {
    const userId = req.user._id;
    const { filter = "last10days", startDate, endDate, month } = req.query;

    let query = { userId };
    const now = new Date();

    if (filter === "today") {
      query.date = getTodayIST();
    } else if (filter === "last7days") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      query.date = { $gte: d.toISOString().split("T")[0] };
    } else if (filter === "thisMonth") {
      const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      query.date = { $regex: `^${monthPrefix}` };
    } else if (filter === "monthWise" && month) {
      query.date = { $regex: `^${month}` };
    } else if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else {
      // Default: Last 10 days
      const d = new Date();
      d.setDate(d.getDate() - 10);
      query.date = { $gte: d.toISOString().split("T")[0] };
    }

    const records = await Attendance.find(query).sort({ date: -1 });

    // Calculate Summary Stats
    const totalDays = records.length;
    const presentDays = records.filter((r) => r.status === "present").length;
    const absentDays = records.filter((r) => r.status === "absent").length;
    const halfDays = records.filter((r) => r.status === "half-day").length;
    const totalWorkingHours = records.reduce((acc, curr) => acc + (curr.totalWorkTime || 0), 0);
    const averageWorkingHours = totalDays > 0 ? Number((totalWorkingHours / totalDays).toFixed(2)) : 0;

    // Timeline Color Rules and Segment Generation
    // Blue = Active Working Time
    // Yellow = Break Time
    // Grey = Checked Out / Inactive / Non-working Time
    const timelineData = records.map((r) => {
      const segments = [];
      const halfDayType = r.halfDayType;

      // Office default window: 10 AM (600 min) to 7 PM (1140 min)
      let workWindowStart = 10 * 60; // 10:00 AM
      let workWindowEnd = 19 * 60; // 7:00 PM

      if (halfDayType === "first-half") {
        workWindowEnd = 14 * 60; // 2:00 PM
      } else if (halfDayType === "second-half") {
        workWindowStart = 14 * 60; // 2:00 PM
      }

      if (r.checkInTime) {
        const checkInDate = new Date(r.checkInTime);
        const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();

        // Grey before check in / before working window
        if (checkInMinutes > workWindowStart) {
          segments.push({
            type: "grey",
            label: "Non-working / Pre-checkin",
            fromMinutes: workWindowStart,
            toMinutes: checkInMinutes,
          });
        }

        let currentPtr = checkInMinutes;

        if (r.breaks && r.breaks.length > 0) {
          r.breaks.forEach((b) => {
            const bStart = new Date(b.startTime);
            const bStartMin = bStart.getHours() * 60 + bStart.getMinutes();

            if (bStartMin > currentPtr) {
              segments.push({
                type: "blue",
                label: "Working Time",
                fromMinutes: currentPtr,
                toMinutes: bStartMin,
              });
            }

            if (b.endTime) {
              const bEnd = new Date(b.endTime);
              const bEndMin = bEnd.getHours() * 60 + bEnd.getMinutes();
              segments.push({
                type: "yellow",
                label: "Break Time",
                fromMinutes: bStartMin,
                toMinutes: bEndMin,
              });
              currentPtr = bEndMin;
            } else {
              segments.push({
                type: "yellow",
                label: "Active Break",
                fromMinutes: bStartMin,
                toMinutes: Math.min(workWindowEnd, now.getHours() * 60 + now.getMinutes()),
              });
              currentPtr = Math.min(workWindowEnd, now.getHours() * 60 + now.getMinutes());
            }
          });
        }

        const checkoutMin = r.checkOutTime
          ? new Date(r.checkOutTime).getHours() * 60 + new Date(r.checkOutTime).getMinutes()
          : Math.min(workWindowEnd, now.getHours() * 60 + now.getMinutes());

        if (checkoutMin > currentPtr) {
          segments.push({
            type: "blue",
            label: "Working Time",
            fromMinutes: currentPtr,
            toMinutes: checkoutMin,
          });
        }

        if (checkoutMin < workWindowEnd) {
          segments.push({
            type: "grey",
            label: "Checked Out / Non-working",
            fromMinutes: checkoutMin,
            toMinutes: workWindowEnd,
          });
        }
      } else {
        segments.push({
          type: "grey",
          label: "Absent / Non-working",
          fromMinutes: workWindowStart,
          toMinutes: workWindowEnd,
        });
      }

      return {
        _id: r._id,
        date: r.date,
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        totalBreakTime: r.totalBreakTime,
        totalWorkTime: r.totalWorkTime,
        status: r.status,
        halfDayType: r.halfDayType,
        timelineSegments: segments,
      };
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalDays,
        presentDays,
        absentDays,
        halfDays,
        totalWorkingHours: Number(totalWorkingHours.toFixed(2)),
        averageWorkingHours,
      },
      data: timelineData,
    });
  } catch (error) {
    console.error("Attendance Timeline Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 3. ATTENDANCE SESSION & HEARTBEAT LOGIC
// ============================================================
exports.startAttendanceSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = getTodayIST();

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    let attendance = await Attendance.findOne({ userId, date: today });
    if (!attendance) {
      attendance = await Attendance.create({
        userId,
        userType: user.role.toLowerCase(),
        date: today,
        status: "absent",
        approvalStatus: "pending",
      });
    }

    const sessionId = "SESS_" + crypto.randomBytes(8).toString("hex");

    // Close any previous active session
    await Session.updateMany({ userId, status: "active" }, { status: "terminated", endTime: new Date() });

    const session = await Session.create({
      sessionId,
      userId,
      attendanceId: attendance._id,
      startTime: new Date(),
      lastActiveTime: new Date(),
      status: "active",
    });

    attendance.sessionId = sessionId;
    attendance.isActiveSession = true;
    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Attendance session started",
      sessionId,
      session,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.sessionHeartbeat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId } = req.body;

    const session = await Session.findOne({ sessionId, userId, status: "active" });
    if (!session) {
      return res.status(404).json({ success: false, message: "Active session not found" });
    }

    session.lastActiveTime = new Date();
    await session.save();

    return res.status(200).json({
      success: true,
      message: "Heartbeat updated",
      lastActiveTime: session.lastActiveTime,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.endAttendanceSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId, reason = "user_checkout" } = req.body;
    const today = getTodayIST();

    const session = await Session.findOne({ sessionId, userId });
    if (session) {
      session.status = reason === "auto_checkout" ? "auto_checkout" : "terminated";
      session.endTime = new Date();
      await session.save();
    }

    const attendance = await Attendance.findOne({ userId, date: today });
    if (attendance) {
      attendance.isActiveSession = false;
      if (!attendance.checkOutTime && attendance.checkInTime) {
        attendance.checkOutTime = session ? session.lastActiveTime : new Date();
        const checkIn = new Date(attendance.approvedCheckInTime || attendance.checkInTime);
        const checkOut = new Date(attendance.checkOutTime);
        let totalMin = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);
        totalMin -= Math.min(attendance.totalBreakTime || 0, 60);
        const hours = Math.max(0, totalMin / 60);
        attendance.totalWorkTime = Number(hours.toFixed(2));

        if (attendance.totalWorkTime >= 8) attendance.status = "present";
        else if (attendance.totalWorkTime >= 4) attendance.status = "half-day";
        else attendance.status = "absent";
      }
      await attendance.save();
    }

    return res.status(200).json({
      success: true,
      message: "Session ended successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 4. BACKGROUND SCREENSHOT MONITORING
// ============================================================
exports.uploadScreenshot = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId, imageUrl } = req.body;
    const today = getTodayIST();

    if (!imageUrl) {
      return res.status(400).json({ success: false, message: "imageUrl is required" });
    }

    const user = await User.findById(userId);
    const employee = await Employee.findOne({ userId });
    const attendance = await Attendance.findOne({ userId, date: today });

    // Save screenshot
    const screenshot = await Screenshot.create({
      sessionId: sessionId || attendance?.sessionId || "SESS_BG",
      userId,
      employeeName: user.name,
      employeeID: user.uniqueID || employee?.employeeID || "",
      date: today,
      captureTime: new Date(),
      checkInTime: attendance?.checkInTime || null,
      imageUrl,
    });

    // Return clean response without revealing screenshot rules/countdown to employee
    return res.status(201).json({
      success: true,
      message: "Sync complete",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin/HR Screenshot Settings
exports.getScreenshotSettings = async (req, res) => {
  try {
    let settings = await MonitoringSettings.findOne().sort({ createdAt: -1 });
    if (!settings) {
      settings = await MonitoringSettings.create({ intervalSeconds: 60, isMonitoringEnabled: true });
    }
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateScreenshotSettings = async (req, res) => {
  try {
    const { intervalSeconds, isMonitoringEnabled } = req.body;
    let settings = await MonitoringSettings.findOne().sort({ createdAt: -1 });
    if (!settings) {
      settings = new MonitoringSettings();
    }
    if (intervalSeconds) settings.intervalSeconds = intervalSeconds;
    if (typeof isMonitoringEnabled === "boolean") settings.isMonitoringEnabled = isMonitoringEnabled;
    settings.updatedBy = req.user._id;

    await settings.save();
    return res.status(200).json({ success: true, message: "Monitoring settings updated", data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getScreenshotsForAdmin = async (req, res) => {
  try {
    const { employeeId, date, sessionId } = req.query;
    let filter = {};
    if (employeeId) filter.userId = employeeId;
    if (date) filter.date = date;
    if (sessionId) filter.sessionId = sessionId;

    const screenshots = await Screenshot.find(filter).sort({ captureTime: -1 });
    return res.status(200).json({ success: true, count: screenshots.length, data: screenshots });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 5. 5-MINUTE INACTIVITY DETECTION & HR NOTIFICATIONS
// ============================================================
exports.logInactivityAlert = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId, durationMinutes = 5 } = req.body;
    const today = getTodayIST();

    const user = await User.findById(userId);
    const employee = await Employee.findOne({ userId });

    const event = await InactivityEvent.create({
      userId,
      employeeName: user.name,
      employeeID: user.uniqueID || employee?.employeeID || "",
      sessionId,
      date: today,
      inactivityStartTime: new Date(Date.now() - durationMinutes * 60 * 1000),
      durationMinutes,
      sessionStatus: "active",
      employeeResponse: "pending",
    });

    // Send Notification to HR/Admin
    const hrAdminUsers = await User.find({ role: { $in: ["hr", "admin"] } }).select("_id");
    for (const admin of hrAdminUsers) {
      await Notification.create({
        userId: admin._id,
        title: "⚠️ Work Activity Alert",
        message: `Employee ${user.name} (${user.uniqueID || "N/A"}) has been inactive for ${durationMinutes} minutes.`,
        type: "SYSTEM",
        metaData: {
          eventId: event._id,
          employeeId: user._id,
          durationMinutes,
        },
      });
    }

    return res.status(201).json({ success: true, message: "Inactivity event logged", eventId: event._id });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.respondInactivityAlert = async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId, response } = req.body; // response: "working" or "break"

    const event = await InactivityEvent.findById(eventId);
    if (event) {
      event.employeeResponse = response === "break" ? "break" : "working";
      event.respondedAt = new Date();
      await event.save();
    }

    if (response === "break") {
      const today = getTodayIST();
      const attendance = await Attendance.findOne({ userId, date: today });
      if (attendance) {
        const hasActiveBreak = attendance.breaks.some((b) => !b.endTime);
        if (!hasActiveBreak) {
          attendance.breaks.push({ startTime: new Date() });
          await attendance.save();
        }
      }
      await Session.updateOne({ userId, status: "active" }, { status: "break" });
    }

    return res.status(200).json({
      success: true,
      message: response === "break" ? "Break started" : "Activity confirmed",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInactivityEventsForAdmin = async (req, res) => {
  try {
    const { date, employeeId } = req.query;
    let filter = {};
    if (date) filter.date = date;
    if (employeeId) filter.userId = employeeId;

    const events = await InactivityEvent.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: events.length, data: events });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 6. DAILY REPORT MODULE
// ============================================================
exports.getAssignedProjectsAndTasks = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get assigned tasks for employee
    const assignedTasks = await TaskManagement.find({ assignedEmployee: userId })
      .populate("projectId", "projectName projectCode description")
      .sort({ createdAt: -1 });

    // Extract unique assigned projects
    const projectMap = new Map();
    assignedTasks.forEach((t) => {
      if (t.projectId && t.projectId._id) {
        projectMap.set(t.projectId._id.toString(), t.projectId);
      }
    });

    const assignedProjects = Array.from(projectMap.values());

    return res.status(200).json({
      success: true,
      projects: assignedProjects,
      tasks: assignedTasks,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitBatchDailyReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const { reports } = req.body; // array of report objects or single report object

    const reportEntries = Array.isArray(reports) ? reports : [req.body];
    const createdReports = [];

    for (const item of reportEntries) {
      const { projectId, todaysWork, pendingWork, tomorrowPlan, issuesFaced, hoursWorked, taskReferences, remarks } = item;

      if (!projectId || !todaysWork || !hoursWorked) {
        continue;
      }

      const report = await DailyReport.create({
        employeeId: userId,
        projectId,
        todaysWork,
        pendingWork: pendingWork || "",
        tomorrowPlan: tomorrowPlan || "",
        issuesFaced: issuesFaced || "",
        hoursWorked: Number(hoursWorked),
        taskReferences: taskReferences || [],
        remarks: remarks || "",
      });

      createdReports.push(report);
    }

    return res.status(201).json({
      success: true,
      message: "Daily report submitted successfully",
      count: createdReports.length,
      data: createdReports,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEmployeeDailyReportHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { search, date, projectId, status, page = 1, limit = 10 } = req.query;

    let filter = { employeeId: userId };

    if (date) filter.reportDate = { $gte: new Date(date), $lte: new Date(date + "T23:59:59.999Z") };
    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { todaysWork: { $regex: search, $options: "i" } },
        { pendingWork: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const reports = await DailyReport.find(filter)
      .populate("projectId", "projectName")
      .populate("taskReferences", "taskTitle")
      .sort({ reportDate: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await DailyReport.countDocuments(filter);

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data: reports,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 7. TASK MANAGEMENT
// ============================================================
exports.getEmployeeTaskManagement = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, priority, projectId, search } = req.query;

    let filter = { assignedEmployee: userId };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (projectId) filter.projectId = projectId;
    if (search) filter.taskTitle = { $regex: search, $options: "i" };

    const tasks = await TaskManagement.find(filter)
      .populate("projectId", "projectName")
      .populate("assignedBy", "name email")
      .populate("comments.commentedBy", "name profileImage")
      .sort({ dueDate: 1 });

    const allMyTasks = await TaskManagement.find({ assignedEmployee: userId });
    const now = new Date();

    const summary = {
      total: allMyTasks.length,
      pending: allMyTasks.filter((t) => t.status === "Pending" || t.status === "Assigned").length,
      inProgress: allMyTasks.filter((t) => t.status === "In Progress").length,
      review: allMyTasks.filter((t) => t.status === "Review" || t.status === "Testing").length,
      completed: allMyTasks.filter((t) => t.status === "Completed").length,
      overdue: allMyTasks.filter((t) => t.status !== "Completed" && t.dueDate && new Date(t.dueDate) < now).length,
    };

    const kanban = {
      toDo: tasks.filter((t) => t.status === "Pending" || t.status === "Assigned"),
      inProgress: tasks.filter((t) => t.status === "In Progress"),
      review: tasks.filter((t) => t.status === "Review" || t.status === "Testing"),
      completed: tasks.filter((t) => t.status === "Completed"),
    };

    return res.status(200).json({
      success: true,
      summary,
      kanban,
      data: tasks,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEmployeeTaskDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { taskId } = req.params;
    const { status, progress, comment, workUpdate } = req.body;

    const task = await TaskManagement.findOne({ _id: taskId, assignedEmployee: userId });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found or unauthorized" });
    }

    if (status) {
      task.status = status;
      if (status === "Completed") task.completedAt = new Date();
      task.taskHistory.push({ action: `Status updated to ${status}`, updatedBy: userId });
    }

    if (typeof progress === "number") {
      task.progress = progress;
    }

    if (comment) {
      task.comments.push({ comment, commentedBy: userId });
    }

    if (workUpdate) {
      task.taskHistory.push({ action: `Work Update: ${workUpdate}`, updatedBy: userId });
    }

    await task.save();

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: task,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 8. LEAVE MANAGEMENT
// ============================================================
exports.getEmployeeLeaveOverview = async (req, res) => {
  try {
    const userId = req.user._id;

    let balance = await LeaveBalance.findOne({ employeeId: userId });
    if (!balance) {
      balance = await LeaveBalance.create({ employeeId: userId, totalLeaves: 20, usedLeaves: 0, remainingLeaves: 20 });
    }

    const leaves = await Leave.find({ employeeId: userId }).sort({ createdAt: -1 });

    const casualLeaves = leaves.filter((l) => l.leaveType === "casual" && l.status === "approved").reduce((a, b) => a + b.totalDays, 0);
    const sickLeaves = leaves.filter((l) => l.leaveType === "sick" && l.status === "approved").reduce((a, b) => a + b.totalDays, 0);
    const pendingRequests = leaves.filter((l) => l.status.includes("pending")).length;

    return res.status(200).json({
      success: true,
      summary: {
        totalLeaves: balance.totalLeaves,
        usedLeaves: balance.usedLeaves,
        remainingLeaves: balance.remainingLeaves,
        casualLeaves,
        sickLeaves,
        pendingRequests,
      },
      history: leaves,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.applyEmployeeLeaveRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { leaveType, startDate, endDate, isHalfDay, halfDayType, reason, attachment } = req.body;

    const user = await User.findById(userId);

    let totalDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    if (isHalfDay) {
      totalDays = 0.5;
    }

    const leave = await Leave.create({
      employeeId: userId,
      applicantRole: user.role,
      leaveType,
      startDate,
      endDate,
      totalDays,
      isHalfDay: !!isHalfDay,
      halfDayType: isHalfDay ? halfDayType : null,
      reason,
      attachment: attachment || "",
      status: user.role === "team lead" ? "pending_hr" : "pending",
      teamLeadStatus: user.role === "team lead" ? "skipped" : "pending",
      hrStatus: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      data: leave,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// 9. NOTIFICATION CENTER
// ============================================================
exports.getEmployeeNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({
      $or: [{ userId }, { userId: null }],
    }).sort({ createdAt: -1 });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return res.status(200).json({
      success: true,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === "read-all") {
      await Notification.updateMany({ $or: [{ userId: req.user._id }, { userId: null }] }, { isRead: true });
    } else {
      await Notification.findByIdAndUpdate(id, { isRead: true });
    }

    return res.status(200).json({ success: true, message: "Notifications updated" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
