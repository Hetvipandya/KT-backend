

const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const {
  OFFICE_LOCATION,
  GEOFENCE_AUTO_CHECKOUT_DELAY_SECONDS,
  validateAttendanceGeofence,
  isBreakStartActive,
} = require("../utils/geofence");

// ============================================================
// BASIC HELPERS
// ============================================================

const pad = (value) => String(value).padStart(2, "0");

const normalizeRoleValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value).trim().toLowerCase();
  const compact = normalized.replace(/[\s_-]+/g, "");

  if (
    compact === "teamlead" ||
    compact === "teamleader"
  ) {
    return "team lead";
  }

  if (compact === "employee" || compact === "staff") {
    return "employee";
  }

  if (compact === "intern") {
    return "intern";
  }

  if (compact === "hr") {
    return "hr";
  }

  if (compact === "admin") {
    return "admin";
  }

  if (compact === "accountant") {
    return "accountant";
  }

  if (compact === "ca") {
    return "ca";
  }

  return normalized;
};

exports.__test__normalizeRoleValue = normalizeRoleValue;

// ============================================================
// DEFAULT SETTINGS
// ============================================================

const DEFAULT_OFFICE_START_TIME = "10:00";
const DEFAULT_LATE_CUTOFF = "10:10";
const DEFAULT_HALF_DAY_CUTOFF = "10:30";
const DEFAULT_ABSENT_CUTOFF = "15:00";
const DEFAULT_OFFICE_END_TIME = "19:00";

const DEFAULT_PRESENT_HOURS = 8;
const DEFAULT_HALF_DAY_HOURS = 4;
const DEFAULT_BREAK_LIMIT = 60;

// ============================================================
// NORMALIZE TIME
// ============================================================

const normalizeTime = (value, fallback) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const parts = value.trim().split(":");

  if (parts.length < 2) {
    return fallback;
  }

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 || 
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return fallback;
  }

  return `${pad(hour)}:${pad(minute)}`;
};

// ============================================================
// TIME TO MINUTES
// ============================================================

const timeToMinutes = (time) => {
  const normalized = normalizeTime(
    time,
    DEFAULT_LATE_CUTOFF
  );

  const [hour, minute] = normalized
    .split(":")
    .map(Number);

  return hour * 60 + minute;
};

// ============================================================
// VALIDATE SETTINGS ORDER
//
// office start <= late cutoff <= absent cutoff <= office end
// ============================================================

const normalizeAttendanceSettings = (source = {}) => {
  const settingsSource =
    source.settings &&
    typeof source.settings === "object"
      ? source.settings
      : source;

  const officeStartTime = normalizeTime(
    settingsSource.officeStartTime,
    DEFAULT_OFFICE_START_TIME
  );

  const lateCutoffTime = normalizeTime(
    settingsSource.lateCutoffTime ??
      settingsSource.lateAfter ??
      settingsSource.lateAfterTime,
    DEFAULT_LATE_CUTOFF
  );

  const halfDayCutoffTime = normalizeTime(
    settingsSource.halfDayCutoffTime ??
      settingsSource.halfDayAfter ??
      settingsSource.halfDayAfterTime,
    DEFAULT_HALF_DAY_CUTOFF
  );

  const absentCutoffTime = normalizeTime(
    settingsSource.absentCutoffTime ??
      settingsSource.absentAfter ??
      settingsSource.absentAfterTime,
    DEFAULT_ABSENT_CUTOFF
  );

  const officeEndTime = normalizeTime(
    settingsSource.officeEndTime,
    DEFAULT_OFFICE_END_TIME
  );

  const presentHours =
    Number(settingsSource.presentHours) ||
    DEFAULT_PRESENT_HOURS;

  const halfDayHours =
    Number(settingsSource.halfDayHours) ||
    DEFAULT_HALF_DAY_HOURS;

  const breakLimit =
    Number(settingsSource.breakLimit) ||
    DEFAULT_BREAK_LIMIT;

  return {
    officeStartTime,
    lateCutoffTime,
    halfDayCutoffTime,
    absentCutoffTime,
    officeEndTime,
    presentHours,
    halfDayHours,
    breakLimit,
  };
};

// ============================================================
// GET ATTENDANCE SETTINGS
// ============================================================

const getAttendanceSettings = (source = {}) => {
  return normalizeAttendanceSettings(source);
};

// ============================================================
// IST DATE PARTS
// ============================================================

const getISTDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(date));

  const get = (type) =>
    parts.find(
      (part) => part.type === type
    )?.value;

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
};

// ============================================================
// GET TODAY IST
// ============================================================

const getToday = (date = new Date()) => {
  const parts = getISTDateParts(date);

  return `${parts.year}-${parts.month}-${parts.day}`;
};

// ============================================================
// FORMAT IST TIME
// ============================================================

const formatISTTime = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find(
    (part) => part.type === "hour"
  )?.value;

  const minute = parts.find(
    (part) => part.type === "minute"
  )?.value;

  return `${hour}:${minute}`;
};

// ============================================================
// FORMAT IST DATE TIME
// ============================================================

const formatISTDateTime = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) =>
    parts.find(
      (part) => part.type === type
    )?.value;

  return `${get("year")}-${get("month")}-${get(
    "day"
  )} ${get("hour")}:${get("minute")}:${get(
    "second"
  )}`;
};

// ============================================================
// IST PARTS -> UTC DATE
// ============================================================

const getISTDateFromParts = ({
  year,
  month,
  day,
  hour,
  minute,
  second,
}) => {
  const utcHour = Number(hour) - 5;
  const utcMinute = Number(minute) - 30;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      utcHour,
      utcMinute,
      Number(second || 0)
    )
  );
};

// ============================================================
// CURRENT IST TIME
// ============================================================

const getISTNow = () => {
  const now = new Date();
  const parts = getISTDateParts(now);

  return getISTDateFromParts(parts);
};

// ============================================================
// CREATE IST TIME FOR A DATE
// ============================================================

const getTimeForDate = (
  date,
  timeString
) => {
  const parts = getISTDateParts(
    new Date(date)
  );

  const normalized = normalizeTime(
    timeString,
    DEFAULT_LATE_CUTOFF
  );

  const [hour, minute] =
    normalized.split(":");

  return getISTDateFromParts({
    ...parts,
    hour,
    minute,
    second: "00",
  });
};

// ============================================================
// CALCULATE ATTENDANCE STATUS
//
// IMPORTANT:
//
// At or before late cutoff = NOT LATE
// After late cutoff and at or before absent cutoff = LATE
// After absent cutoff = ABSENT
//
// ============================================================

const calculateAttendanceStatus = (
  checkInTime,
  settings
) => {
  if (!checkInTime) {
    return {
      isLate: false,
      isAbsentDueToLate: false,
      status: "absent",
    };
  }

  const checkIn = new Date(checkInTime);

  if (Number.isNaN(checkIn.getTime())) {
    return {
      isLate: false,
      isAbsentDueToLate: false,
      status: "absent",
    };
  }

  const lateCutoff = getTimeForDate(
    checkIn,
    settings.lateCutoffTime || DEFAULT_LATE_CUTOFF
  );

  const halfDayCutoff = getTimeForDate(
    checkIn,
    settings.halfDayCutoffTime || DEFAULT_HALF_DAY_CUTOFF
  );

  const absentCutoff = getTimeForDate(
    checkIn,
    settings.absentCutoffTime || DEFAULT_ABSENT_CUTOFF
  );

  const timestamp =
    checkIn.getTime();

  const lateTimestamp =
    lateCutoff.getTime();

  const halfDayTimestamp =
    halfDayCutoff.getTime();

  const absentTimestamp =
    absentCutoff.getTime();

  // ==========================================================
  // NOT LATE (10:00 AM to 10:10 AM)
  // ==========================================================

  if (timestamp <= lateTimestamp) {
    return {
      isLate: false,
      isHalfDay: false,
      isAbsentDueToLate: false,
      status: "present",
      lateCutoff,
      halfDayCutoff,
      absentCutoff,
    };
  }

  // ==========================================================
  // LATE (10:11 AM to 10:30 AM)
  // ==========================================================

  if (timestamp <= halfDayTimestamp) {
    return {
      isLate: true,
      isHalfDay: false,
      isAbsentDueToLate: false,
      status: "present",
      lateCutoff,
      halfDayCutoff,
      absentCutoff,
    };
  }

  // ==========================================================
  // HALF DAY (10:31 AM to 3:00 PM / 15:00)
  // ==========================================================

  if (timestamp <= absentTimestamp) {
    return {
      isLate: true,
      isHalfDay: true,
      isAbsentDueToLate: false,
      status: "half-day",
      lateCutoff,
      halfDayCutoff,
      absentCutoff,
    };
  }

  // ==========================================================
  // ABSENT (> 3:00 PM / 15:00)
  // ==========================================================

  return {
    isLate: true,
    isHalfDay: false,
    isAbsentDueToLate: true,
    status: "absent",
    lateCutoff,
    halfDayCutoff,
    absentCutoff,
  };
};

// ============================================================
// BACKWARD COMPATIBILITY
// ============================================================

const calculateLateStatus = (
  checkInTime,
  lateCutoffTime,
  absentCutoffTime
) => {
  const settings = {
    lateCutoffTime:
      normalizeTime(
        lateCutoffTime,
        DEFAULT_LATE_CUTOFF
      ),

    absentCutoffTime:
      normalizeTime(
        absentCutoffTime,
        DEFAULT_ABSENT_CUTOFF
      ),
  };

  const result =
    calculateAttendanceStatus(
      checkInTime,
      settings
    );

  return result;
};

// ============================================================
// GET WORKING HOURS
// ============================================================

const getWorkingHours = (
  checkIn,
  checkOut,
  breakTime = 0
) => {
  if (!checkIn || !checkOut) {
    return 0;
  }

  const checkInDate =
    new Date(checkIn);

  const checkOutDate =
    new Date(checkOut);

  let totalMinutes =
    (
      checkOutDate.getTime() -
      checkInDate.getTime()
    ) /
    (1000 * 60);

  const breakMinutes = Number(breakTime) || 0;

  totalMinutes -= breakMinutes;

  return Math.max(
    0,
    totalMinutes / 60
  );
};

// ============================================================
// CALCULATE BREAK TIMER STATE & REMINDER NOTIFICATIONS
// ============================================================

const calculateBreakTimerState = (attendance) => {
  const maxSeconds = 3600; // 60 minutes max limit

  if (!attendance || !Array.isArray(attendance.breaks)) {
    return {
      isOnBreak: false,
      status: "no_active_break",
      statusDisplay: "No Active Break",
      maxDurationMinutes: 60,
      maxDurationSeconds: maxSeconds,
      startTime: null,
      startTimeDisplay: null,
      startTimeFullDisplay: null,
      elapsedSeconds: 0,
      elapsedMinutes: 0,
      elapsedTimeDisplay: "0h 0m",
      remainingSeconds: maxSeconds,
      remainingMinutes: 60,
      remainingTimeDisplay: "1h 0m",
      isOverdue: false,
      overdueMinutes: 0,
      reminder: null,
      reminderTitle: null,
      reminderMessage: null,
      showPopup: false,
      popupType: null,
      serverTime: new Date().toISOString(),
      serverTimestamp: Date.now(),
    };
  }

  const activeBreak = attendance.breaks.find((b) => !b.endTime);

  if (!activeBreak || !activeBreak.startTime) {
    return {
      isOnBreak: false,
      status: "no_active_break",
      statusDisplay: "No Active Break",
      maxDurationMinutes: 60,
      maxDurationSeconds: maxSeconds,
      startTime: null,
      startTimeDisplay: null,
      startTimeFullDisplay: null,
      elapsedSeconds: 0,
      elapsedMinutes: 0,
      elapsedTimeDisplay: "0h 0m",
      remainingSeconds: maxSeconds,
      remainingMinutes: 60,
      remainingTimeDisplay: "1h 0m",
      isOverdue: false,
      overdueMinutes: 0,
      reminder: null,
      reminderTitle: null,
      reminderMessage: null,
      showPopup: false,
      popupType: null,
      serverTime: new Date().toISOString(),
      serverTimestamp: Date.now(),
    };
  }

  const now = new Date();
  const startTime = new Date(activeBreak.startTime);
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startTime.getTime()) / 1000));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  const remainingSeconds = Math.max(0, maxSeconds - elapsedSeconds);
  const remainingMinutes = Math.ceil(remainingSeconds / 60);

  const isOverdue = elapsedSeconds >= maxSeconds;
  const overdueMinutes = isOverdue ? Math.floor((elapsedSeconds - maxSeconds) / 60) : 0;

  let status = "on_break";
  let statusDisplay = "On Break";
  let reminder = null;
  let reminderTitle = null;
  let reminderMessage = null;
  let showPopup = false;
  let popupType = null;

  if (isOverdue) {
    status = "break_time_exceeded";
    statusDisplay = "Break Time Exceeded";
    reminder = "break_over";
    reminderTitle = "Break Time Over";
    reminderMessage = "Your break time is over. Please return to work.";
    showPopup = true;
    popupType = "overdue";
  } else if (remainingSeconds <= 300) { // 5 minutes or less
    status = "on_break";
    statusDisplay = "On Break (5m Left)";
    reminder = "5_min_left";
    reminderTitle = "5 Minutes Remaining";
    reminderMessage = "5 minutes remaining. Please return to work.";
    showPopup = true;
    popupType = "urgent";
  } else if (remainingSeconds <= 600) { // 10 minutes or less
    status = "on_break";
    statusDisplay = "On Break (10m Left)";
    reminder = "10_min_left";
    reminderTitle = "10 Minutes Remaining";
    reminderMessage = "10 minutes remaining. Please return to work soon.";
    showPopup = true;
    popupType = "warning";
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const elapsedMinsRem = elapsedMinutes % 60;
  const elapsedTimeDisplay = `${elapsedHours}h ${elapsedMinsRem}m`;

  const remainingHours = Math.floor(remainingMinutes / 60);
  const remainingMinsRem = remainingMinutes % 60;
  const remainingTimeDisplay = `${remainingHours}h ${remainingMinsRem}m`;

  return {
    isOnBreak: true,
    status,
    statusDisplay,
    maxDurationMinutes: 60,
    maxDurationSeconds: maxSeconds,
    startTime: activeBreak.startTime,
    startTimeDisplay: formatISTTime(activeBreak.startTime),
    startTimeFullDisplay: formatISTDateTime(activeBreak.startTime),
    elapsedSeconds,
    elapsedMinutes,
    elapsedTimeDisplay,
    remainingSeconds,
    remainingMinutes,
    remainingTimeDisplay,
    isOverdue,
    overdueMinutes,
    reminder,
    reminderTitle,
    reminderMessage,
    showPopup,
    popupType,
    serverTime: now.toISOString(),
    serverTimestamp: now.getTime(),
  };
};

exports.calculateBreakTimerState = calculateBreakTimerState;

// ============================================================
// FORMAT ATTENDANCE
// ============================================================

const formatAttendanceDocument = (
  attendance
) => {
  if (!attendance) {
    return attendance;
  }

  const plainAttendance =
    attendance.toObject?.() ??
    JSON.parse(
      JSON.stringify(attendance)
    );

  const formatDateField = (
    fieldName
  ) => {
    if (
      plainAttendance[fieldName]
    ) {
      plainAttendance[
        `${fieldName}Display`
      ] = formatISTTime(
        plainAttendance[fieldName]
      );

      plainAttendance[
        `${fieldName}FullDisplay`
      ] = formatISTDateTime(
        plainAttendance[fieldName]
      );
    }
  };

  formatDateField("checkInTime");
  formatDateField("checkOutTime");
  formatDateField("approvedAt");
  formatDateField(
    "approvedCheckInTime"
  );
  formatDateField("createdAt");
  formatDateField("updatedAt");

  if (plainAttendance.date) {
    plainAttendance.dateDisplay =
      plainAttendance.date;
  }

  // ==========================================================
  // BREAKS
  // ==========================================================

  if (
    plainAttendance.breaks?.length
  ) {
    plainAttendance.breaks =
      plainAttendance.breaks.map(
        (breakItem) => ({
          ...breakItem,

          startTimeDisplay:
            formatISTTime(
              breakItem.startTime
            ),

          endTimeDisplay:
            formatISTTime(
              breakItem.endTime
            ),

          startTimeFullDisplay:
            formatISTDateTime(
              breakItem.startTime
            ),

          endTimeFullDisplay:
            formatISTDateTime(
              breakItem.endTime
            ),
        })
      );
  }

  // ==========================================================
  // TOTAL WORK TIME
  // ==========================================================

  if (
    plainAttendance.totalWorkTime !=
    null
  ) {
    const hours = Math.floor(
      Number(
        plainAttendance.totalWorkTime
      )
    );

    const minutes = Math.round(
      (
        Number(
          plainAttendance.totalWorkTime
        ) - hours
      ) * 60
    );

    plainAttendance.totalWorkTimeDisplay =
      `${hours}h ${minutes}m`;

    plainAttendance.totalWorkTimeHours =
      `${Number(
        plainAttendance.totalWorkTime
      ).toFixed(2)} hours`;
  }

  // ==========================================================
  // TOTAL BREAK TIME
  // ==========================================================

  if (
    plainAttendance.totalBreakTime !=
    null
  ) {
    const hours = Math.floor(
      Number(
        plainAttendance.totalBreakTime
      ) / 60
    );

    const minutes = Math.round(
      Number(
        plainAttendance.totalBreakTime
      ) % 60
    );

    plainAttendance.totalBreakTimeDisplay =
      `${hours}h ${minutes}m`;
  }

  plainAttendance.breakTimer = calculateBreakTimerState(plainAttendance);

  return plainAttendance;
};

// ============================================================
// GET DATE-WISE ATTENDANCE
// ============================================================

const getDateWiseAttendance =
  async (date) => {
    const Employee =
      require("../models/Employee");

    const users =
      await User.find({
        isApproved: { $ne: false },
        role: { $nin: ["admin", "Admin"] },
      }).select(
        "_id name uniqueID role email department phone"
      );

    const teamLeadEmployees =
      await Employee.find({
        isTeamLead: true,
      }).select("userID userId");

    const teamLeadIds = new Set();
    teamLeadEmployees.forEach((item) => {
      const id = item.userID || item.userId;
      if (id) teamLeadIds.add(id.toString());
    });

    const allEmployees = await Employee.find({}).select("_id userID userId");
    const empToUserMap = new Map();
    allEmployees.forEach((emp) => {
      const uId = emp.userID || emp.userId;
      if (uId) {
        empToUserMap.set(emp._id.toString(), uId.toString());
      }
    });

    const membersMap =
      new Map();

    users.forEach((user) => {
      let role =
        user.role?.toLowerCase();

      if (role === "admin") return;

      if (
        teamLeadIds.has(
          user._id.toString()
        )
      ) {
        role = "team lead";
      }

      membersMap.set(
        user._id.toString(),
        {
          user,
          role: normalizeRoleValue(role),
        }
      );
    });

    const attendanceRecords =
      await Attendance.find({
        date,
      })
        .populate({
          path: "userId",
          select:
            "name uniqueID role email department phone",
        })
        .populate({
          path: "approvedBy",
          select:
            "name uniqueID role",
        })
        .sort({
          updatedAt: -1,
          createdAt: -1,
        });

    const attendanceMap =
      new Map();

    attendanceRecords.forEach(
      (attendance) => {
        let matchedUserId = attendance.userId?._id
          ? attendance.userId._id.toString()
          : attendance.userId
          ? attendance.userId.toString()
          : null;

        if (matchedUserId && empToUserMap.has(matchedUserId)) {
          matchedUserId = empToUserMap.get(matchedUserId);
        }

        if (
          matchedUserId &&
          !attendanceMap.has(
            matchedUserId
          )
        ) {
          attendanceMap.set(
            matchedUserId,
            attendance
          );
        }
      }
    );

    const result = [];

    for (
      const member of membersMap.values()
    ) {
      const user =
        member.user;

      const userId =
        user._id.toString();

      const attendance =
        attendanceMap.get(userId);

      if (!attendance) {
        result.push({
          _id: null,

          employee: {
            _id: user._id,
            name: user.name || "",
            uniqueID:
              user.uniqueID || "",
            email:
              user.email || "",
            department:
              user.department || "",
            phone:
              user.phone || "",
            role:
              member.role ||
              user.role ||
              "",
          },

          date,
          dateDisplay: date,

          checkInTime: null,
          checkInTimeDisplay: null,
          checkInTimeFullDisplay: null,

          approvedCheckInTime: null,
          approvedCheckInTimeDisplay:
            null,
          approvedCheckInTimeFullDisplay:
            null,

          checkOutTime: null,
          checkOutTimeDisplay: null,
          checkOutTimeFullDisplay: null,

          breaks: [],

          totalBreakTime: 0,
          totalBreakTimeDisplay:
            "0h 0m",

          totalWorkTime: 0,
          totalWorkTimeDisplay:
            "0h 0m",

          totalWorkTimeHours:
            "0.00 hours",

          isLate: false,

          status: "absent",

          approvalStatus:
            "not_checked_in",

          approvedAt: null,
          approvedAtDisplay: null,
          approvedAtFullDisplay: null,

          approvedBy: null,

          createdAt: null,
          createdAtDisplay: null,

          updatedAt: null,
          updatedAtDisplay: null,

          lateCutoffTime:
            DEFAULT_LATE_CUTOFF,

          absentCutoffTime:
            DEFAULT_ABSENT_CUTOFF,
        });

        continue;
      }

      const data =
        formatAttendanceDocument(
          attendance
        );

      result.push({
        _id: data._id,

        employee: {
          _id:
            data.userId?._id ||
            user._id,

          name:
            data.userId?.name ||
            user.name ||
            "",

          uniqueID:
            data.userId?.uniqueID ||
            user.uniqueID ||
            "",

          email:
            data.userId?.email ||
            user.email ||
            "",

          department:
            data.userId?.department ||
            user.department ||
            "",

          phone:
            data.userId?.phone ||
            user.phone ||
            "",

          role:
            member.role ||
            data.userId?.role ||
            user.role ||
            "",
        },

        date:
          data.date || date,

        dateDisplay:
          data.dateDisplay || date,

        checkInTime:
          data.checkInTime || null,

        checkInTimeDisplay:
          data.checkInTimeDisplay ||
          null,

        checkInTimeFullDisplay:
          data.checkInTimeFullDisplay ||
          null,

        approvedCheckInTime:
          data.approvedCheckInTime ||
          null,

        approvedCheckInTimeDisplay:
          data.approvedCheckInTimeDisplay ||
          null,

        approvedCheckInTimeFullDisplay:
          data.approvedCheckInTimeFullDisplay ||
          null,

        checkOutTime:
          data.checkOutTime || null,

        checkOutTimeDisplay:
          data.checkOutTimeDisplay ||
          null,

        checkOutTimeFullDisplay:
          data.checkOutTimeFullDisplay ||
          null,

        breaks:
          data.breaks || [],

        totalBreakTime:
          data.totalBreakTime || 0,

        totalBreakTimeDisplay:
          data.totalBreakTimeDisplay ||
          "0h 0m",

        totalWorkTime:
          data.totalWorkTime || 0,

        totalWorkTimeDisplay:
          data.totalWorkTimeDisplay ||
          "0h 0m",

        totalWorkTimeHours:
          data.totalWorkTimeHours ||
          "0.00 hours",

        isLate:
          data.isLate || false,

        status:
          data.status || "absent",

        approvalStatus:
          data.approvalStatus ||
          "pending",

        approvedAt:
          data.approvedAt || null,

        approvedAtDisplay:
          data.approvedAtDisplay ||
          null,

        approvedAtFullDisplay:
          data.approvedAtFullDisplay ||
          null,

        approvedBy:
          data.approvedBy
            ? {
                _id:
                  data.approvedBy._id,
                name:
                  data.approvedBy.name,
                uniqueID:
                  data.approvedBy.uniqueID,
                role:
                  data.approvedBy.role,
              }
            : null,

        createdAt:
          data.createdAt || null,

        createdAtDisplay:
          data.createdAtDisplay ||
          null,

        updatedAt:
          data.updatedAt || null,

        updatedAtDisplay:
          data.updatedAtDisplay ||
          null,

        lateCutoffTime:
          data.lateCutoffTime ||
          DEFAULT_LATE_CUTOFF,

        absentCutoffTime:
          data.absentCutoffTime ||
          DEFAULT_ABSENT_CUTOFF,
      });
    }

    return result;
  };

// ============================================================
// ENSURE TODAY ATTENDANCE
// ============================================================

const ensureTodayAttendance =
  async (date = getToday()) => {
    try {
      const users =
        await User.find({
          isApproved: { $ne: false },
        }).select("_id role");

      const Employee =
        require("../models/Employee");

      const teamLeadEmployees =
        await Employee.find({
          isTeamLead: true,
        }).select("userId");

      const membersMap =
        new Map();

      users.forEach((user) => {
        membersMap.set(
          user._id.toString(),
          {
            _id: user._id,
            role: user.role,
          }
        );
      });

      teamLeadEmployees.forEach(
        (employee) => {
          if (employee.userId) {
            membersMap.set(
              employee.userId.toString(),
              {
                _id:
                  employee.userId,
                role: "teamlead",
              }
            );
          }
        }
      );

      const existingAttendance =
        await Attendance.find({
          date,
        }).select("userId");

      const existingUserIds =
        new Set(
          existingAttendance.map(
            (attendance) =>
              attendance.userId.toString()
          )
        );

      const absentRecords = [];

      for (
        const member of membersMap.values()
      ) {
        const userId =
          member._id.toString();

        if (
          !existingUserIds.has(
            userId
          )
        ) {
          absentRecords.push({
            userId: member._id,

            userType:
              normalizeRoleValue(member.role),

            date,

            checkInTime: null,
            approvedCheckInTime: null,
            checkOutTime: null,

            breaks: [],

            totalBreakTime: 0,
            totalWorkTime: 0,

            isLate: false,

            status: "absent",

            approvalStatus:
              "approved",
          });
        }
      }

      if (
        absentRecords.length > 0
      ) {
        await Attendance.insertMany(
          absentRecords
        );
      }

      return {
        success: true,
        date,
        created:
          absentRecords.length,
      };
    } catch (error) {
      console.error(
        "ensureTodayAttendance Error:",
        error
      );

      throw error;
    }
  };

// ============================================================
// CHECK IN
// ============================================================

exports.checkIn = async (
  req,
  res
) => {
  try {
    const userId =
      req.body.userId ||
      req.body.id ||
      req.body.employeeId ||
      req.user?._id ||
      req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message:
          "userId is required",
      });
    }

    // ========================================================
    // GPS GEOFENCING VALIDATION
    // ========================================================
    const geofenceResult = validateAttendanceGeofence(req.body);
    if (!geofenceResult.isInside) {
      return res.status(400).json({
        success: false,
        message:
          geofenceResult.error ||
          "You are outside the office location. Please reach the office to continue.",
        distance: geofenceResult.distance,
        allowedRadius: OFFICE_LOCATION.radiusMeters,
      });
    }

    const user =
      await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    const userType = normalizeRoleValue(user.role);

    if (!userType) {
      return res.status(400).json({
        success: false,
        message: "User role is missing. Please contact admin.",
      });
    }

    const date = getToday();

    // ========================================================
    // READ CURRENT FRONTEND SETTINGS
    // ========================================================

    const settings =
      getAttendanceSettings(
        req.body
      );

    // ========================================================
    // ENSURE ATTENDANCE
    // ========================================================

    await ensureTodayAttendance(
      date
    );

    let attendance =
      await Attendance.findOne({
        userId,
        date,
      });

    if (!attendance) {
      attendance =
        await Attendance.create({
          userId,
          userType,
          date,

          checkInTime: null,
          approvedCheckInTime: null,
          checkOutTime: null,

          breaks: [],

          totalBreakTime: 0,
          totalWorkTime: 0,

          isLate: false,

          status: "absent",

          approvalStatus:
            "approved",
        });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: "You have already checked out for today.",
        data: formatAttendanceDocument(attendance),
      });
    }

    if (
      attendance.approvalStatus ===
      "pending"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Your check-in request is already pending admin approval.",

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    }

    if (
      attendance.checkInTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You have already checked in today.",

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    }

    // ========================================================
    // ACTUAL CHECK-IN
    // ========================================================

    const actualCheckInTime =
      getISTNow();

    // ========================================================
    // CALCULATE STATUS
    //
    // THIS USES THE SETTINGS THAT WERE SENT DURING CHECK-IN
    // ========================================================

    const attendanceStatus =
      calculateAttendanceStatus(
        actualCheckInTime,
        settings
      );

    // ========================================================
    // SAVE
    // ========================================================

    attendance.userType =
      userType;

    attendance.checkInTime =
      actualCheckInTime;

    attendance.checkInLocation = {
      latitude: geofenceResult.latitude,
      longitude: geofenceResult.longitude,
      distanceFromOffice: geofenceResult.distance,
    };

    attendance.approvedCheckInTime =
      null;

    attendance.checkOutTime =
      null;

    attendance.breaks = [];

    attendance.totalBreakTime = 0;

    attendance.totalWorkTime = 0;

    attendance.isLate =
      attendanceStatus.isLate;

    // ========================================================
    // SAVE SETTINGS WITH THIS ATTENDANCE
    //
    // IMPORTANT:
    // These settings belong to this attendance record.
    // ========================================================

    attendance.officeStartTime =
      settings.officeStartTime;

    attendance.lateCutoffTime =
      settings.lateCutoffTime;

    attendance.absentCutoffTime =
      settings.absentCutoffTime;

    attendance.officeEndTime =
      settings.officeEndTime;

    attendance.presentHours =
      settings.presentHours;

    attendance.halfDayHours =
      settings.halfDayHours;

    attendance.breakLimit =
      settings.breakLimit;

    // ========================================================
    // STATUS
    // ========================================================

    attendance.status =
      attendanceStatus.status;

    // ========================================================
    // APPROVAL REQUIRED
    // ========================================================

    attendance.approvalStatus =
      "pending";

    await attendance.save();

    // ========================================================
    // MESSAGE
    // ========================================================

    let message;

    if (
      attendanceStatus.isAbsentDueToLate
    ) {
      message =
        `Check-in request sent successfully. ` +
        `You checked in at ${formatISTTime(
          actualCheckInTime
        )}, which is after ${settings.absentCutoffTime}. ` +
        `You will be marked absent after approval.`;
    } else if (
      attendanceStatus.isLate
    ) {
      message =
        `Check-in request sent successfully. ` +
        `You checked in at ${formatISTTime(
          actualCheckInTime
        )}. You are marked as late.`;
    } else {
      message =
        `Check-in request sent successfully at ${formatISTTime(
          actualCheckInTime
        )}. Waiting for admin approval.`;
    }

    return res.status(201).json({
      success: true,

      message,

      settings: {
        officeStartTime:
          settings.officeStartTime,

        lateCutoffTime:
          settings.lateCutoffTime,

        absentCutoffTime:
          settings.absentCutoffTime,

        officeEndTime:
          settings.officeEndTime,

        presentHours:
          settings.presentHours,

        halfDayHours:
          settings.halfDayHours,

        breakLimit:
          settings.breakLimit,
      },

      timerStartTime: null,

      data:
        formatAttendanceDocument(
          attendance
        ),
    });
  } catch (err) {
    console.error(
      "CheckIn Error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ============================================================
// APPROVE ATTENDANCE
//
// CRITICAL FIX:
//
// NEVER let stale frontend settings overwrite the settings
// saved during check-in.
//
// Priority:
//
// 1. Attendance's saved settings
// 2. Request settings
// 3. Defaults
//
// ============================================================

exports.approveAttendance =
  async (req, res) => {
    try {
      const {
        attendanceId,
        approvedBy,
        lateCutoffTime,
        absentCutoffTime,
      } = req.body;
      const approverId = req.user?._id || approvedBy;

      if (
        !attendanceId ||
        !approverId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "attendanceId is required",
        });
      }

      const approver =
        await User.findById(
          approverId
        );

      if (!approver) {
        return res.status(404).json({
          success: false,
          message:
            "Approver not found",
        });
      }

      const approverRole = normalizeRoleValue(approver.role);

      if (
        !["admin", "hr"].includes(
          approverRole
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Only Admin or HR can approve attendance",
        });
      }

      const attendance =
        await Attendance.findById(
          attendanceId
        );

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Attendance request not found",
        });
      }

      if (
        attendance.approvalStatus ===
        "approved"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Attendance already approved",
        });
      }

      if (
        attendance.approvalStatus ===
        "rejected"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Attendance request has already been rejected",
        });
      }

      const checkInTime =
        attendance.checkInTime;

      if (!checkInTime) {
        return res.status(400).json({
          success: false,
          message:
            "Actual check-in time not found. Employee must check in again.",
        });
      }

      // ======================================================
      // CRITICAL FIX
      //
      // DO NOT blindly use frontend approval values.
      //
      // Attendance already contains the settings that were
      // active when employee checked in.
      // ======================================================

      const settings =
        getAttendanceSettings({
          officeStartTime:
            attendance.officeStartTime ||
            req.body.officeStartTime,

          lateCutoffTime:
            attendance.lateCutoffTime ||
            lateCutoffTime,

          absentCutoffTime:
            attendance.absentCutoffTime ||
            absentCutoffTime,

          officeEndTime:
            attendance.officeEndTime ||
            req.body.officeEndTime,

          presentHours:
            attendance.presentHours ||
            req.body.presentHours,

          halfDayHours:
            attendance.halfDayHours ||
            req.body.halfDayHours,

          breakLimit:
            attendance.breakLimit ||
            req.body.breakLimit,
        });

      // ======================================================
      // APPROVAL TIME
      //
      // This is ONLY approval time.
      // It is NEVER check-in time.
      // ======================================================

      const approvalTime =
        getISTNow();

      // ======================================================
      // CALCULATE USING ACTUAL CHECK-IN
      // ======================================================

      const attendanceStatus =
        calculateAttendanceStatus(
          checkInTime,
          settings
        );

      // ======================================================
      // APPROVE
      // ======================================================

      attendance.approvalStatus =
        "approved";

      attendance.approvedBy =
        approver._id;

      attendance.approvedAt =
        approvalTime;

      // ======================================================
      // ACTUAL CHECK-IN REMAINS UNCHANGED
      // ======================================================

      attendance.checkInTime =
        checkInTime;

      attendance.approvedCheckInTime =
        checkInTime;

      attendance.isLate =
        attendanceStatus.isLate;

      // ======================================================
      // SAVE THE SAME SETTINGS
      // ======================================================

      attendance.officeStartTime =
        settings.officeStartTime;

      attendance.lateCutoffTime =
        settings.lateCutoffTime;

      attendance.absentCutoffTime =
        settings.absentCutoffTime;

      attendance.officeEndTime =
        settings.officeEndTime;

      attendance.presentHours =
        settings.presentHours;

      attendance.halfDayHours =
        settings.halfDayHours;

      attendance.breakLimit =
        settings.breakLimit;

      // ======================================================
      // STATUS
      // ======================================================

      attendance.status =
        attendanceStatus.status;

      await attendance.save();

      // ======================================================
      // MESSAGE
      // ======================================================

      let message;

      if (
        attendanceStatus.isAbsentDueToLate
      ) {
        message =
          `Attendance approved, but employee is marked ABSENT ` +
          `because check-in was after ${settings.absentCutoffTime}. ` +
          `(Checked in at ${formatISTTime(
            checkInTime
          )})`;
      } else if (
        attendanceStatus.isLate
      ) {
        message =
          `Attendance approved by ${approver.role}. ` +
          `Employee checked in as LATE. ` +
          `(Checked in at ${formatISTTime(
            checkInTime
          )})`;
      } else {
        message =
          `Attendance approved by ${approver.role}. ` +
          `Employee checked in successfully. ` +
          `(Checked in at ${formatISTTime(
            checkInTime
          )})`;
      }

      return res.status(200).json({
        success: true,

        message,

        settings: {
          officeStartTime:
            settings.officeStartTime,

          lateCutoffTime:
            settings.lateCutoffTime,

          absentCutoffTime:
            settings.absentCutoffTime,

          officeEndTime:
            settings.officeEndTime,

          presentHours:
            settings.presentHours,

          halfDayHours:
            settings.halfDayHours,

          breakLimit:
            settings.breakLimit,
        },

        // TIMER STARTS FROM ACTUAL CHECK-IN
        timerStartTime:
          attendance.approvedCheckInTime,

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "ApproveAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// CHECK OUT
// ============================================================

exports.checkOut = async (req, res) => {
  try {
    const userId =
      req.body?.userId ||
      req.body?.id ||
      req.body?.employeeId ||
      req.user?._id ||
      req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    clearPendingGeofenceTimer(userId);

    const today = getToday();
    let attendance = await Attendance.findOne({
      userId,
      date: today,
    });

    if (!attendance) {
      attendance = await Attendance.findOne({
        userId,
        checkInTime: { $ne: null },
        checkOutTime: null,
      }).sort({ createdAt: -1 });
    }

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Active check-in record not found for today.",
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: "Already checked out today",
        data: formatAttendanceDocument(attendance),
      });
    }

    const checkInTime = attendance.approvedCheckInTime || attendance.checkInTime;

    if (!checkInTime) {
      return res.status(400).json({
        success: false,
        message: "Check-in time not found.",
      });
    }

    // Enforce geofence: manual checkout is only allowed within 70m of office
    const geofenceResult = validateAttendanceGeofence(req.body);
    if (!geofenceResult.isInside) {
      return res.status(400).json({
        success: false,
        message:
          geofenceResult.error ||
          `You are outside the office location (${geofenceResult.distance}m away). Manual check-out is only allowed within ${OFFICE_LOCATION.radiusMeters} meters of the office.`,
        distance: geofenceResult.distance,
        allowedRadius: OFFICE_LOCATION.radiusMeters,
      });
    }

    const checkoutTime = getISTNow();

    // Auto-close any active break if user checks out while on break
    const activeBreak = attendance.breaks?.find((item) => !item.endTime);
    if (activeBreak) {
      activeBreak.endTime = checkoutTime;
      const breakDurationMs = checkoutTime.getTime() - new Date(activeBreak.startTime).getTime();
      const safeDuration = Math.max(0, breakDurationMs / (1000 * 60));
      activeBreak.duration = Number(safeDuration.toFixed(2));
      activeBreak.endLocation = {
        latitude: geofenceResult.latitude,
        longitude: geofenceResult.longitude,
        distanceFromOffice: geofenceResult.distance,
      };

      const breakLimit = attendance.breakLimit || DEFAULT_BREAK_LIMIT;
      activeBreak.isOverdue = safeDuration > breakLimit;
      activeBreak.overdueMinutes = safeDuration > breakLimit ? Number((safeDuration - breakLimit).toFixed(2)) : 0;

      // Recalculate totalBreakTime
      const completedBreaks = attendance.breaks.filter((b) => b.endTime);
      attendance.totalBreakTime = Number(
        completedBreaks.reduce(
          (sum, b) => sum + (Number(b.duration) || 0),
          0
        ).toFixed(2)
      );
    }

    const breakLimit = attendance.breakLimit || DEFAULT_BREAK_LIMIT;
    const isBreakOverdue = attendance.totalBreakTime > breakLimit;
    const overdueBreakMinutes = isBreakOverdue
      ? Math.max(0, Number((attendance.totalBreakTime - breakLimit).toFixed(2)))
      : 0;

    attendance.isBreakOverdue = isBreakOverdue;
    attendance.overdueBreakMinutes = overdueBreakMinutes;

    attendance.checkOutTime = checkoutTime;
    attendance.checkOutLocation = {
      latitude: geofenceResult.latitude,
      longitude: geofenceResult.longitude,
      distanceFromOffice: geofenceResult.distance,
    };
    attendance.isActiveSession = false;

    const settings = getAttendanceSettings({
      officeStartTime: attendance.officeStartTime,
      lateCutoffTime: attendance.lateCutoffTime,
      absentCutoffTime: attendance.absentCutoffTime,
      officeEndTime: attendance.officeEndTime,
      presentHours: attendance.presentHours,
      halfDayHours: attendance.halfDayHours,
      breakLimit: attendance.breakLimit,
    });

    const totalHours = getWorkingHours(
      checkInTime,
      checkoutTime,
      attendance.totalBreakTime
    );

    attendance.totalWorkTime = Number(totalHours.toFixed(2));

    const attendanceStatus = calculateAttendanceStatus(
      checkInTime,
      settings
    );

    attendance.isLate = attendanceStatus.isLate;

    if (attendanceStatus.isAbsentDueToLate) {
      attendance.status = "absent";
    } else if (
      attendanceStatus.status === "half-day" ||
      attendance.totalWorkTime < (settings.presentHours || 8)
    ) {
      attendance.status = "half-day";
    } else {
      attendance.status = "present";
    }

    await attendance.save();

    // Terminate active sessions for user
    try {
      const Session = require("../models/Session");
      await Session.updateMany(
        { userId, status: { $in: ["active", "break"] } },
        { $set: { status: "terminated", endTime: new Date() } }
      );
    } catch (_) {}

    let message = "Check-Out Successful";
    if (isBreakOverdue) {
      message = `Check-Out Successful. Note: Break time exceeded 1 hour limit by ${Math.round(overdueBreakMinutes)} minutes.`;
    }

    return res.status(200).json({
      success: true,
      message,
      totalWorkTime: attendance.totalWorkTime,
      totalBreakTime: attendance.totalBreakTime,
      isBreakOverdue,
      overdueBreakMinutes,
      warning: isBreakOverdue
        ? `Break time exceeded 1 hour limit by ${Math.round(overdueBreakMinutes)} minutes.`
        : null,
      status: attendance.status,
      timerStartTime: checkInTime,
      data: formatAttendanceDocument(attendance),
    });
  } catch (err) {
    console.error("CheckOut Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ============================================================
// BREAK START
// ============================================================

exports.startBreak =
  async (req, res) => {
    try {
      const userId =
        req.body?.userId ||
        req.body?.id ||
        req.body?.employeeId ||
        req.user?._id ||
        req.user?.id;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "userId is required",
        });
      }

      clearPendingGeofenceTimer(userId);

      // ======================================================
      // GPS GEOFENCING VALIDATION
      // ======================================================
      const geofenceResult = validateAttendanceGeofence(req.body);
      if (!geofenceResult.isInside) {
        return res.status(400).json({
          success: false,
          message:
            geofenceResult.error ||
            `You are outside the office location (${geofenceResult.distance}m away). Break-in is only allowed within ${OFFICE_LOCATION.radiusMeters} meters of the office.`,
          distance: geofenceResult.distance,
          allowedRadius: OFFICE_LOCATION.radiusMeters,
        });
      }

      const today = getToday();
      let attendance =
        await Attendance.findOne({
          userId,
          date: today,
        });

      if (!attendance) {
        attendance = await Attendance.findOne({
          userId,
          checkInTime: { $ne: null },
          checkOutTime: null,
        }).sort({ createdAt: -1 });
      }

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Please check in first before taking a break.",
        });
      }

      if (
        attendance.approvalStatus !==
        "approved"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Your check-in request is not approved yet. Please wait for admin approval.",
        });
      }

      if (attendance.checkOutTime) {
        return res.status(400).json({
          success: false,
          message:
            "Already checked out for today. Cannot start break.",
        });
      }

      if (!attendance.checkInTime) {
        return res.status(400).json({
          success: false,
          message:
            "Please check in first before taking a break.",
        });
      }

      const activeBreak =
        attendance.breaks.find(
          (item) => !item.endTime
        );

      if (activeBreak) {
        return res.status(400).json({
          success: false,
          message:
            "Break already started. Please break out before starting a new break.",
          breakTimer: calculateBreakTimerState(attendance),
          data: formatAttendanceDocument(attendance),
        });
      }

      const breakStartTime = getISTNow();
      attendance.breaks.push({
        startTime: breakStartTime,
        startLocation: {
          latitude: geofenceResult.latitude,
          longitude: geofenceResult.longitude,
          distanceFromOffice: geofenceResult.distance,
        },
      });

      await attendance.save();

      try {
        const Session = require("../models/Session");
        await Session.updateMany(
          { userId, status: "active" },
          { $set: { status: "break", lastActiveTime: new Date() } }
        );
      } catch (_) {}

      const timerState = calculateBreakTimerState(attendance);
      const breakLimit = attendance.breakLimit || DEFAULT_BREAK_LIMIT;
      const isExceeded = (Number(attendance.totalBreakTime) || 0) >= breakLimit;

      let message = "Break started successfully";
      if (isExceeded) {
        message = `Break started. Warning: You have already used ${attendance.totalBreakTime} mins of break today (1 hour limit).`;
      }

      return res.status(200).json({
        success: true,
        message,
        isOnBreak: true,
        status: timerState.status,
        timerState,
        breakTimer: timerState,
        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "StartBreak Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// BREAK END
// ============================================================

exports.endBreak =
  async (req, res) => {
    try {
      const userId =
        req.body?.userId ||
        req.body?.id ||
        req.body?.employeeId ||
        req.user?._id ||
        req.user?.id;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "userId is required",
        });
      }

      // Enforce geofence: break-out is ONLY allowed inside 70m radius
      const geofenceResult = validateAttendanceGeofence(req.body);
      if (!geofenceResult.isInside) {
        return res.status(400).json({
          success: false,
          message:
            geofenceResult.error ||
            `You are outside the office location (${geofenceResult.distance}m away). Break-out is only allowed within ${OFFICE_LOCATION.radiusMeters} meters of the office. Please return inside the 70-meter radius to end your break.`,
          distance: geofenceResult.distance,
          allowedRadius: OFFICE_LOCATION.radiusMeters,
          isOnBreak: true,
          breakActive: true,
        });
      }

      const today = getToday();
      let attendance =
        await Attendance.findOne({
          userId,
          date: today,
        });

      if (!attendance) {
        attendance = await Attendance.findOne({
          userId,
          checkInTime: { $ne: null },
          checkOutTime: null,
        }).sort({ createdAt: -1 });
      }

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Attendance not found. Please check in first.",
        });
      }

      if (
        attendance.approvalStatus !==
        "approved"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Your check-in request is not approved yet. Please wait for admin approval.",
        });
      }

      if (!attendance.checkInTime) {
        return res.status(400).json({
          success: false,
          message:
            "Please check in first.",
        });
      }

      if (attendance.checkOutTime) {
        return res.status(400).json({
          success: false,
          message:
            "Already checked out today.",
        });
      }

      const activeBreak =
        attendance.breaks.find(
          (item) => !item.endTime
        );

      if (!activeBreak) {
        return res.status(400).json({
          success: false,
          message:
            "No active break found. You are not currently on break.",
        });
      }

      const endTime =
        getISTNow();

      activeBreak.endTime =
        endTime;

      activeBreak.endLocation = {
        latitude: geofenceResult.latitude,
        longitude: geofenceResult.longitude,
        distanceFromOffice: geofenceResult.distance,
      };

      const duration =
        (
          endTime.getTime() -
          new Date(
            activeBreak.startTime
          ).getTime()
        ) /
        (1000 * 60);

      const safeDuration =
        Math.max(
          0,
          duration
        );

      activeBreak.duration =
        Number(
          safeDuration.toFixed(2)
        );

      const breakLimit = attendance.breakLimit || DEFAULT_BREAK_LIMIT;
      activeBreak.isOverdue = safeDuration > breakLimit;
      activeBreak.overdueMinutes =
        safeDuration > breakLimit
          ? Number((safeDuration - breakLimit).toFixed(2))
          : 0;

      // Recalculate totalBreakTime across completed breaks
      const completedBreaks = attendance.breaks.filter((b) => b.endTime);
      attendance.totalBreakTime = Number(
        completedBreaks
          .reduce((sum, b) => sum + (Number(b.duration) || 0), 0)
          .toFixed(2)
      );

      const isOverallOverdue =
        attendance.totalBreakTime > breakLimit || activeBreak.isOverdue;
      const totalOverdueMinutes = Math.max(
        0,
        Number((attendance.totalBreakTime - breakLimit).toFixed(2))
      );

      attendance.isBreakOverdue = isOverallOverdue;
      attendance.overdueBreakMinutes = totalOverdueMinutes;

      await attendance.save();

      try {
        const Session = require("../models/Session");
        await Session.updateMany(
          { userId, status: { $in: ["break", "break-start", "break_start", "on_break"] } },
          { $set: { status: "active", lastActiveTime: new Date() } }
        );
      } catch (_) {}



      const timerState = calculateBreakTimerState(attendance);
      let message = "Break ended successfully";
      if (isOverallOverdue || activeBreak.isOverdue) {
        const overMins = Math.round(totalOverdueMinutes || activeBreak.overdueMinutes);
        message = `Break ended. Warning: Break exceeded 1 hour (${breakLimit} mins) limit by ${overMins} minutes.`;
      }

      return res.status(200).json({
        success: true,
        message,
        breakDuration: activeBreak.duration,
        totalBreakTime: attendance.totalBreakTime,
        isOverdue: isOverallOverdue,
        overdueMinutes: totalOverdueMinutes || activeBreak.overdueMinutes,
        warning: isOverallOverdue
          ? `Break time exceeded 1 hour limit by ${Math.round(totalOverdueMinutes || activeBreak.overdueMinutes)} minutes.`
          : null,
        timerState,
        breakTimer: timerState,
        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "EndBreak Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET BREAK STATUS & TIMER
// ============================================================

exports.getBreakStatus = async (req, res) => {
  try {
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.query.userId ||
      req.query.id ||
      req.body?.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const today = getToday();
    let attendance = await Attendance.findOne({ userId, date: today });
    if (!attendance) {
      attendance = await Attendance.findOne({
        userId,
        checkInTime: { $ne: null },
        checkOutTime: null,
      }).sort({ createdAt: -1 });
    }

    const breakTimer = calculateBreakTimerState(attendance);

    return res.status(200).json({
      success: true,
      data: breakTimer,
      breakTimer,
      attendance: attendance ? formatAttendanceDocument(attendance) : null,
    });
  } catch (err) {
    console.error("GetBreakStatus Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ============================================================
// REJECT ATTENDANCE
// ============================================================

exports.rejectAttendance =
  async (req, res) => {
    try {
      const {
        attendanceId,
        reason, 
      } = req.body;

      if (!attendanceId) {
        return res.status(400).json({
          success: false,
          message:
            "attendanceId is required",
        });
      }

      if (
        !reason ||
        !reason.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rejection reason is required",
        });
      }

      const attendance =
        await Attendance.findById(
          attendanceId
        );

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Attendance not found",
        });
      }

      if (
        attendance.approvalStatus ===
        "approved"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Attendance already approved, cannot reject",
        });
      }

      attendance.approvalStatus =
        "rejected";

      attendance.rejectionReason =
        reason.trim();

      await attendance.save();

      return res.json({
        success: true,

        message:
          "Attendance Rejected",

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "RejectAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET ALL ATTENDANCE FOR ADMIN
// ============================================================

exports.getAllAttendanceForAdmin =
  async (req, res) => {
    try {
      const requestedDate =
        req.query.date;

      const date =
        requestedDate ||
        getToday();

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          date
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "date must be in YYYY-MM-DD format",
        });
      }

      const attendanceRecords =
        await getDateWiseAttendance(
          date
        );

      const attendance =
        attendanceRecords.map(
          (record) => {
            const user =
              record.employee;

            return {
              ...record,

              user: user
                ? {
                    _id: user._id,
                    name: user.name,
                    uniqueID:
                      user.uniqueID,
                    role: user.role,
                    department:
                      user.department,
                    email: user.email,
                  }
                : null,

              employee: user
                ? {
                    _id: user._id,
                    name: user.name,
                    uniqueID:
                      user.uniqueID,
                    role: user.role,
                    department:
                      user.department,
                    email: user.email,
                  }
                : null,

              employeeName:
                user?.name ||
                "Unknown Employee",

              email:
                user?.email || "",
            };
          }
        );

      const present =
        attendance.filter(
          (item) =>
            String(
              item.status || ""
            ).toLowerCase() ===
            "present"
        ).length;

      const late =
        attendance.filter(
          (item) =>
            item.isLate === true &&
            String(
              item.status || ""
            ).toLowerCase() !==
              "absent"
        ).length;

      const halfDay =
        attendance.filter(
          (item) => {
            const status =
              String(
                item.status || ""
              )
                .toLowerCase()
                .trim();

            return (
              status ===
                "half-day" ||
              status ===
                "halfday" ||
              status ===
                "half day"
            );
          }
        ).length;

      const absent =
        attendance.filter(
          (item) =>
            String(
              item.status || ""
            ).toLowerCase() ===
            "absent"
        ).length;

      const notCheckedIn =
        attendance.filter(
          (item) =>
            String(
              item.approvalStatus ||
                ""
            )
              .toLowerCase()
              .trim() ===
            "not_checked_in"
        ).length;

      const pending =
        attendance.filter(
          (item) =>
            String(
              item.approvalStatus ||
                ""
            )
              .toLowerCase()
              .trim() ===
            "pending"
        ).length;

      const approved =
        attendance.filter(
          (item) =>
            String(
              item.approvalStatus ||
                ""
            )
              .toLowerCase()
              .trim() ===
            "approved"
        ).length;

      const roleWise = {
        employee: 0,
        intern: 0,
        "team lead": 0,
        other: 0,
      };

      attendance.forEach(
        (item) => {
          const role =
            String(
              item?.user?.role ||
                item?.employee?.role ||
                item?.userType ||
                ""
            )
              .toLowerCase()
              .trim();

          if (
            role === "employee"
          ) {
            roleWise.employee++;
          } else if (
            role === "intern"
          ) {
            roleWise.intern++;
          } else if (
            role === "team lead"
          ) {
            roleWise["team lead"]++;
          } else {
            roleWise.other++;
          }
        }
      );

      return res.status(200).json({
        success: true,

        date,

        count:
          attendance.length,

        summary: {
          total:
            attendance.length,

          present,
          late,
          halfDay,
          absent,

          pending,
          approved,
          notCheckedIn,

          roleWise,
        },

        attendance,
      });
    } catch (err) {
      console.error(
        "GetAllAttendanceForAdmin Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET TODAY ATTENDANCE
// ============================================================

exports.getTodayAttendance = async (req, res) => {
  try {
    const userId = req.query.userId || req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const today = getToday();

    let attendance = await Attendance.findOne({
      userId,
      date: today,
    })
      .populate(
        "userId",
        "name email phone uniqueID department role"
      )
      .populate(
        "approvedBy",
        "name email role uniqueID"
      );

    if (!attendance) {
      attendance = await Attendance.findOne({
        userId,
        checkInTime: { $ne: null },
        checkOutTime: null,
      })
        .sort({ createdAt: -1 })
        .populate(
          "userId",
          "name email phone uniqueID department role"
        )
        .populate(
          "approvedBy",
          "name email role uniqueID"
        );
    }

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found for today",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: formatAttendanceDocument(attendance),
    });
  } catch (err) {
    console.error("GetTodayAttendance Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ============================================================
// GET ATTENDANCE BY ID
// ============================================================

exports.getAttendanceById =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (id === "today") {
        return exports.getTodayAttendance(req, res);
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid attendance ID format",
        });
      }

      const attendance =
        await Attendance.findById(
          id
        )
          .populate(
            "userId",
            "name email phone uniqueID department role"
          )
          .populate(
            "approvedBy",
            "name email role uniqueID"
          );

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Attendance not found",
        });
      }

      return res.status(200).json({
        success: true,

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "GetAttendanceById Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET PENDING ATTENDANCE
// ============================================================

exports.getPendingAttendance =
  async (req, res) => {
    try {
      const data =
        await Attendance.find({
          approvalStatus:
            "pending",
        }).populate(
          "userId",
          "name uniqueID role"
        );

      return res.json({
        success: true,

        count:
          data.length,

        data: data.map(
          formatAttendanceDocument
        ),
      });
    } catch (err) {
      console.error(
        "GetPendingAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET MY ATTENDANCE HISTORY
// ============================================================

exports.getMyAttendanceHistory =
  async (req, res) => {
    try {
      const { userId } =
        req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "userId is required",
        });
      }

      const attendance =
        await Attendance.find({
          userId,
        })
          .populate(
            "userId",
            "name email uniqueID role department"
          )
          .sort({
            date: -1,
          });

      return res.status(200).json({
        success: true,

        count:
          attendance.length,

        data: attendance.map(
          formatAttendanceDocument
        ),
      });
    } catch (err) {
      console.error(
        "GetMyAttendanceHistory Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET ATTENDANCE BY DATE
// ============================================================

exports.getAttendanceByDate =
  async (req, res) => {
    try {
      const { date } =
        req.params;

      if (!date) {
        return res.status(400).json({
          success: false,
          message:
            "date is required (YYYY-MM-DD)",
        });
      }

      const attendance =
        await Attendance.find({
          date,
        }).populate(
          "userId",
          "name uniqueID role department"
        );

      return res.status(200).json({
        success: true,

        count:
          attendance.length,

        data: attendance.map(
          formatAttendanceDocument
        ),
      });
    } catch (err) {
      console.error(
        "GetAttendanceByDate Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET SINGLE ATTENDANCE
// ============================================================

exports.getSingleAttendance =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const attendance =
        await Attendance.findById(
          id
        ).populate(
          "userId",
          "name email uniqueID role department"
        );

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message:
            "Attendance not found",
        });
      }

      return res.status(200).json({
        success: true,

        data:
          formatAttendanceDocument(
            attendance
          ),
      });
    } catch (err) {
      console.error(
        "GetSingleAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET MONTHLY ATTENDANCE
// ============================================================

exports.getMonthlyAttendance =
  async (req, res) => {
    try {
      const {
        userId,
        month,
      } = req.params;

      if (
        !userId ||
        !month
      ) {
        return res.status(400).json({
          success: false,
          message:
            "userId and month are required (YYYY-MM)",
        });
      }

      const attendance =
        await Attendance.find({
          userId,

          date: {
            $regex: `^${month}`,
          },
        }).sort({
          date: -1,
        });

      return res.status(200).json({
        success: true,

        count:
          attendance.length,

        data: attendance.map(
          formatAttendanceDocument
        ),
      });
    } catch (err) {
      console.error(
        "GetMonthlyAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// ATTENDANCE STATS
// ============================================================

exports.getAttendanceStats =
  async (req, res) => {
    try {
      const today =
        getToday();

      const stats =
        await Attendance.aggregate([
          {
            $match: {
              date: today,
            },
          },

          {
            $group: {
              _id:
                "$approvalStatus",

              count: {
                $sum: 1,
              },
            },
          },
        ]);

      const result = {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0,
      };

      stats.forEach(
        (item) => {
          if (
            result[
              item._id
            ] !== undefined
          ) {
            result[item._id] =
              item.count;
          }

          result.total +=
            item.count;
        }
      );

      const presentCount =
        await Attendance.countDocuments(
          {
            date: today,
            approvalStatus:
              "approved",
            status:
              "present",
          }
        );

      const absentCount =
        await Attendance.countDocuments(
          {
            date: today,
            approvalStatus:
              "approved",
            status:
              "absent",
          }
        );

      const halfDayCount =
        await Attendance.countDocuments(
          {
            date: today,
            approvalStatus:
              "approved",
            status:
              "half-day",
          }
        );

      return res.status(200).json({
        success: true,

        data: {
          ...result,

          present:
            presentCount,

          absent:
            absentCount,

          halfDay:
            halfDayCount,
        },
      });
    } catch (err) {
      console.error(
        "GetAttendanceStats Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET ABSENT ATTENDANCE
// ============================================================

exports.getAbsentAttendance =
  async (req, res) => {
    try {
      const {
        date,
      } = req.params;

      const query = {
        date:
          date || getToday(),

        $or: [
          {
            approvalStatus:
              "approved",
            status:
              "absent",
          },

          {
            approvalStatus:
              "pending",
            status:
              "absent",
          },
        ],
      };

      const absentRecords =
        await Attendance.find(
          query
        )
          .populate({
            path: "userId",
            select:
              "name uniqueID role email department phone",
          })
          .populate({
            path: "approvedBy",
            select:
              "name uniqueID role",
          })
          .sort({
            createdAt: -1,
          });

      const formatted =
        absentRecords.map(
          (item) => {
            const data =
              formatAttendanceDocument(
                item
              );

            return {
              _id: data._id,

              employee: {
                _id:
                  data.userId?._id,

                name:
                  data.userId?.name ||
                  "",

                uniqueID:
                  data.userId
                    ?.uniqueID ||
                  "",

                email:
                  data.userId?.email ||
                  "",

                department:
                  data.userId
                    ?.department ||
                  "",

                phoneNumber:
                  data.userId
                    ?.phone ||
                  "",

                role:
                  data.userId?.role ||
                  data.userType,
              },

              date:
                data.date,

              dateDisplay:
                data.dateDisplay,

              checkInTime:
                data.checkInTime,

              checkInTimeDisplay:
                data.checkInTimeDisplay,

              checkInTimeFullDisplay:
                data.checkInTimeFullDisplay,

              approvedCheckInTime:
                data.approvedCheckInTime,

              approvedCheckInTimeDisplay:
                data.approvedCheckInTimeDisplay,

              approvedCheckInTimeFullDisplay:
                data.approvedCheckInTimeFullDisplay,

              checkOutTime:
                data.checkOutTime,

              checkOutTimeDisplay:
                data.checkOutTimeDisplay,

              checkOutTimeFullDisplay:
                data.checkOutTimeFullDisplay,

              breaks:
                data.breaks,

              totalBreakTime:
                data.totalBreakTime,

              totalBreakTimeDisplay:
                data.totalBreakTimeDisplay,

              totalWorkTime:
                data.totalWorkTime,

              totalWorkTimeDisplay:
                data.totalWorkTimeDisplay,

              isLate:
                data.isLate,

              status:
                data.status,

              approvalStatus:
                data.approvalStatus,

              approvedAt:
                data.approvedAt,

              approvedAtDisplay:
                data.approvedAtDisplay,

              approvedAtFullDisplay:
                data.approvedAtFullDisplay,

              approvedBy:
                data.approvedBy
                  ? {
                      _id:
                        data.approvedBy
                          ._id,

                      name:
                        data.approvedBy
                          .name,

                      uniqueID:
                        data.approvedBy
                          .uniqueID,

                      role:
                        data.approvedBy
                          .role,
                    }
                  : null,

              createdAt:
                data.createdAt,

              createdAtDisplay:
                data.createdAtDisplay,

              updatedAt:
                data.updatedAt,

              updatedAtDisplay:
                data.updatedAtDisplay,

              lateCutoffTime:
                data.lateCutoffTime,

              absentCutoffTime:
                data.absentCutoffTime,
            };
          }
        );

      const roleWise = {
        employee: 0,
        intern: 0,
        "team lead": 0,
        other: 0,
      };

      formatted.forEach(
        (record) => {
          const role =
            record.employee?.role
              ?.toLowerCase()
              .trim() ||
            "other";

          if (
            role === "employee"
          ) {
            roleWise.employee++;
          } else if (
            role === "intern"
          ) {
            roleWise.intern++;
          } else if (
            role === "team lead" ||
            role ===
              "team lead" ||
            role ===
              "team_lead"
          ) {
            roleWise["team lead"]++;
          } else {
            roleWise.other++;
          }
        }
      );

      return res.status(200).json({
        success: true,

        message:
          `Absent attendance records for ${query.date}`,

        summary: {
          total:
            formatted.length,

          pending:
            absentRecords.filter(
              (record) =>
                record.approvalStatus ===
                "pending"
            ).length,

          approved:
            absentRecords.filter(
              (record) =>
                record.approvalStatus ===
                "approved"
            ).length,

          date:
            query.date,

          roleWise,
        },

        data: formatted,
      });
    } catch (err) {
      console.error(
        "GetAbsentAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET ABSENT ATTENDANCE BY DATE RANGE
// ============================================================

exports.getAbsentAttendanceByDateRange =
  async (req, res) => {
    try {
      const {
        startDate,
        endDate,
      } = req.query;

      if (
        !startDate ||
        !endDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            "startDate and endDate are required (YYYY-MM-DD)",
        });
      }

      const query = {
        date: {
          $gte: startDate,
          $lte: endDate,
        },

        $or: [
          {
            approvalStatus:
              "approved",
            status:
              "absent",
          },

          {
            approvalStatus:
              "pending",
            status:
              "absent",
          },
        ],
      };

      const absentRecords =
        await Attendance.find(
          query
        )
          .populate({
            path: "userId",
            select:
              "name uniqueID role email department phone",
          })
          .populate({
            path: "approvedBy",
            select:
              "name uniqueID role",
          })
          .sort({
            date: -1,
            createdAt: -1,
          });

      const formatted =
        absentRecords.map(
          (item) => {
            const data =
              formatAttendanceDocument(
                item
              );

            return {
              _id: data._id,

              employee: {
                _id:
                  data.userId?._id,

                name:
                  data.userId?.name ||
                  "",

                uniqueID:
                  data.userId
                    ?.uniqueID ||
                  "",

                email:
                  data.userId?.email ||
                  "",

                department:
                  data.userId
                    ?.department ||
                  "",

                phoneNumber:
                  data.userId
                    ?.phone ||
                  "",

                role:
                  data.userId?.role ||
                  data.userType,
              },

              date:
                data.date,

              dateDisplay:
                data.dateDisplay,

              checkInTime:
                data.checkInTime,

              checkInTimeDisplay:
                data.checkInTimeDisplay,

              checkInTimeFullDisplay:
                data.checkInTimeFullDisplay,

              approvedCheckInTime:
                data.approvedCheckInTime,

              approvedCheckInTimeDisplay:
                data.approvedCheckInTimeDisplay,

              approvedCheckInTimeFullDisplay:
                data.approvedCheckInTimeFullDisplay,

              checkOutTime:
                data.checkOutTime,

              checkOutTimeDisplay:
                data.checkOutTimeDisplay,

              checkOutTimeFullDisplay:
                data.checkOutTimeFullDisplay,

              breaks:
                data.breaks,

              totalBreakTime:
                data.totalBreakTime,

              totalBreakTimeDisplay:
                data.totalBreakTimeDisplay,

              totalWorkTime:
                data.totalWorkTime,

              totalWorkTimeDisplay:
                data.totalWorkTimeDisplay,

              isLate:
                data.isLate,

              status:
                data.status,

              approvalStatus:
                data.approvalStatus,

              approvedAt:
                data.approvedAt,

              approvedAtDisplay:
                data.approvedAtDisplay,

              approvedAtFullDisplay:
                data.approvedAtFullDisplay,

              approvedBy:
                data.approvedBy
                  ? {
                      _id:
                        data.approvedBy
                          ._id,

                      name:
                        data.approvedBy
                          .name,

                      uniqueID:
                        data.approvedBy
                          .uniqueID,

                      role:
                        data.approvedBy
                          .role,
                    }
                  : null,

              createdAt:
                data.createdAt,

              createdAtDisplay:
                data.createdAtDisplay,

              updatedAt:
                data.updatedAt,

              updatedAtDisplay:
                data.updatedAtDisplay,
            };
          }
        );

      const dailyBreakdown =
        {};

      formatted.forEach(
        (record) => {
          const recordDate =
            record.date;

          if (
            !dailyBreakdown[
              recordDate
            ]
          ) {
            dailyBreakdown[
              recordDate
            ] = {
              date:
                recordDate,

              count: 0,

              pending: 0,

              approved: 0,

              employees: [],
            };
          }

          dailyBreakdown[
            recordDate
          ].count++;

          if (
            record.approvalStatus ===
            "pending"
          ) {
            dailyBreakdown[
              recordDate
            ].pending++;
          } else if (
            record.approvalStatus ===
            "approved"
          ) {
            dailyBreakdown[
              recordDate
            ].approved++;
          }

          dailyBreakdown[
            recordDate
          ].employees.push({
            _id:
              record.employee._id,

            name:
              record.employee.name,

            uniqueID:
              record.employee.uniqueID,

            role:
              record.employee.role,
          });
        }
      );

      return res.status(200).json({
        success: true,

        message:
          `Absent attendance records from ${startDate} to ${endDate}`,

        summary: {
          total:
            formatted.length,

          startDate,
          endDate,

          dateRange:
            `${startDate} to ${endDate}`,
        },

        dailyBreakdown:
          Object.values(
            dailyBreakdown
          ),

        data: formatted,
      });
    } catch (err) {
      console.error(
        "GetAbsentAttendanceByDateRange Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

// ============================================================
// GET ALL ABSENT ATTENDANCE
// ============================================================

exports.getAllAbsentAttendance =
  async (req, res) => {
    try {
      const date =
        req.query.date ||
        getToday();

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          date
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "date must be in YYYY-MM-DD format",
        });
      }

      const attendance =
        await getDateWiseAttendance(
          date
        );

      const absentRecords =
        attendance.filter(
          (item) =>
            item.status ===
            "absent"
        );

      const roleWise = {
        employee: 0,
        intern: 0,
        teamlead: 0,
        other: 0,
      };

      absentRecords.forEach(
        (record) => {
          const role =
            record.employee?.role
              ?.toLowerCase()
              ?.trim() ||
            "other";

          if (
            role === "employee"
          ) {
            roleWise.employee++;
          } else if (
            role === "intern"
          ) {
            roleWise.intern++;
          } else if (
            role === "teamlead" ||
            role ===
              "team lead" ||
            role ===
              "team_lead"
          ) {
            roleWise.teamlead++;
          } else {
            roleWise.other++;
          }
        }
      );

      const notCheckedIn =
        absentRecords.filter(
          (item) =>
            item.approvalStatus ===
            "not_checked_in"
        ).length;

      const checkedInAbsent =
        absentRecords.filter(
          (item) =>
            item.approvalStatus !==
            "not_checked_in"
        ).length;

      return res.status(200).json({
        success: true,

        message:
          `Absent attendance records for ${date}`,

        summary: {
          date,

          total:
            absentRecords.length,

          notCheckedIn,

          checkedInAbsent,

          roleWise,
        },

        data: absentRecords,
      });
    } catch (err) {
      console.error(
        "GetAllAbsentAttendance Error:",
        err
      );

      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

exports.recalculateAllAttendance = async (req, res) => {
  try {
    const settings = getAttendanceSettings(req.user || {});
    const records = await Attendance.find({});
    let updatedCount = 0;

    for (const record of records) {
      let newStatus = record.status;
      let newIsLate = record.isLate;

      if (!record.checkInTime) {
        newStatus = "absent";
        newIsLate = false;
      } else {
        const attStatus = determineAttendanceStatus(record.checkInTime, settings);
        newIsLate = attStatus.isLate;

        if (attStatus.isAbsentDueToLate) {
          newStatus = "absent";
        } else if (
          attStatus.status === "half-day" ||
          (record.totalWorkTime || 0) < settings.presentHours
        ) {
          newStatus = "half-day";
        } else {
          newStatus = "present";
        }
      }

      if (record.status !== newStatus || record.isLate !== newIsLate) {
        record.status = newStatus;
        record.isLate = newIsLate;
        await record.save();
        updatedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully recalculated attendance. Updated ${updatedCount} out of ${records.length} records.`,
      updatedCount,
      totalRecords: records.length,
    });
  } catch (error) {
    console.error("RecalculateAllAttendance Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// PENDING GEOFENCE TIMERS & AUTO CHECKOUT HELPERS
// ============================================================

const pendingGeofenceCheckouts = new Map();

const clearPendingGeofenceTimer = (userId) => {
  if (!userId) return;
  const key = userId.toString();
  const existing = pendingGeofenceCheckouts.get(key);
  if (existing?.timer) {
    clearTimeout(existing.timer);
  }
  pendingGeofenceCheckouts.delete(key);
};

const clearAllGeofenceTimers = () => {
  for (const [key, value] of pendingGeofenceCheckouts.entries()) {
    if (value?.timer) {
      clearTimeout(value.timer);
    }
  }
  pendingGeofenceCheckouts.clear();
};

const executeAutoCheckout = async ({
  attendanceId,
  userId,
  location,
  deviceType = "device",
  breachTime = new Date(),
  reason = "geofence_exit",
}) => {
  try {
    let attendance = null;
    if (attendanceId) {
      attendance = await Attendance.findById(attendanceId);
    }
    if (!attendance && userId) {
      const today = getToday();
      attendance = await Attendance.findOne({ userId, date: today });
      if (!attendance) {
        attendance = await Attendance.findOne({
          userId,
          checkInTime: { $ne: null },
          checkOutTime: null,
        }).sort({ createdAt: -1 });
      }
    }

    if (!attendance || !attendance.checkInTime || attendance.checkOutTime) {
      clearPendingGeofenceTimer(userId || attendance?.userId);
      return attendance;
    }

    // Check if on break - if on break, cancel auto checkout
    let currentSession = null;
    try {
      const Session = require("../models/Session");
      currentSession = await Session.findOne({
        userId: attendance.userId,
        status: { $in: ["active", "break", "break-start", "break_start", "on_break"] },
      }).sort({ createdAt: -1 });
    } catch (_) {}

    const activeBreak = Array.isArray(attendance.breaks)
      ? attendance.breaks.find((b) => !b.endTime)
      : null;
    const isOnBreak =
      !!activeBreak ||
      attendance.isOnBreak === true ||
      attendance.status === "break" ||
      isBreakStartActive(attendance, currentSession);

    if (isOnBreak) {
      clearPendingGeofenceTimer(userId || attendance?.userId);
      return attendance;
    }

    const checkoutTime = getISTNow();
    attendance.checkOutTime = checkoutTime;
    attendance.checkOutLocation = {
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      distanceFromOffice:
        location?.distance !== undefined
          ? location.distance
          : (location?.distanceFromOffice || null),
      device: deviceType,
    };
    attendance.isActiveSession = false;
    attendance.autoCheckedOut = true;
    attendance.autoCheckedOutBy = "AUTO_GEOFENCE_CHECKOUT";
    attendance.outsideGeofenceAt = breachTime || attendance.outsideGeofenceAt || new Date();
    attendance.outsideGeofenceCountdown = 0;

    const checkInTime = attendance.approvedCheckInTime || attendance.checkInTime;
    const totalHours = getWorkingHours(
      checkInTime,
      checkoutTime,
      attendance.totalBreakTime
    );
    attendance.totalWorkTime = Number(totalHours.toFixed(2));

    const settings = getAttendanceSettings({
      officeStartTime: attendance.officeStartTime,
      lateCutoffTime: attendance.lateCutoffTime,
      absentCutoffTime: attendance.absentCutoffTime,
      officeEndTime: attendance.officeEndTime,
      presentHours: attendance.presentHours,
      halfDayHours: attendance.halfDayHours,
      breakLimit: attendance.breakLimit,
    });

    const attendanceStatus = calculateAttendanceStatus(
      checkInTime,
      settings
    );
    attendance.isLate = attendanceStatus.isLate;

    if (attendanceStatus.isAbsentDueToLate) {
      attendance.status = "absent";
    } else if (
      attendanceStatus.status === "half-day" ||
      attendance.totalWorkTime < (settings.presentHours || 8)
    ) {
      attendance.status = "half-day";
    } else {
      attendance.status = "present";
    }

    await attendance.save();

    // Close session for web/laptop
    try {
      const Session = require("../models/Session");
      await Session.updateMany(
        { userId: attendance.userId, status: { $in: ["active", "break", "break-start", "break_start", "on_break"] } },
        { $set: { status: "auto_checkout", endTime: new Date() } }
      );
    } catch (_) {}

    clearPendingGeofenceTimer(userId || attendance?.userId);
    return attendance;
  } catch (error) {
    console.error("Execute Auto-Checkout Error:", error);
    throw error;
  }
};

// ============================================================
// CHECK LOCATION GEOFENCE & 10-SECOND AUTO CHECKOUT
//
// Rules:
// 1. Device within 70m office radius -> checked-in safe, cancels any pending timer.
// 2. Active break (break-start / BREAK_IN) -> skip auto-checkout even if > 70m outside.
// 3. Status is checked-in & device goes outside 70m:
//    - Initiates a 10-second timer countdown.
//    - If device returns inside 70m within 10 seconds -> auto-checkout cancelled.
//    - If device remains outside 70m for 10 seconds -> automatic check-out executes!
// ============================================================

exports.checkLocationGeofence = async (req, res) => {
  try {
    const payload = { ...req.query, ...req.body };
    const userId =
      payload.userId ||
      payload.user_id ||
      payload.id ||
      req.user?._id ||
      req.user?.id;

    const deviceType =
      payload.deviceType ||
      payload.device ||
      payload.platform ||
      payload.source ||
      (req.headers?.["user-agent"]?.toLowerCase().includes("mobile") ? "phone" : "laptop");

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const geofenceResult = validateAttendanceGeofence(payload);

    console.log(
      `[Geofence Debug] User: ${userId} | Distance: ${geofenceResult.distance}m | Allowed Radius: ${OFFICE_LOCATION.radiusMeters}m | IsInside: ${geofenceResult.isInside}`
    );

    // If coordinates/distance are missing or invalid, do not perform auto checkout
    if (geofenceResult.distance === null) {
      return res.status(400).json({
        success: false,
        message: geofenceResult.error || "Valid GPS coordinates or distance are required.",
      });
    }

    const today = getToday();
    let attendance = await Attendance.findOne({
      userId,
      date: today,
    });

    if (!attendance) {
      attendance = await Attendance.findOne({
        userId,
        checkInTime: { $ne: null },
        checkOutTime: null,
      }).sort({ createdAt: -1 });
    }

    // Check if not checked in or already checked out
    if (!attendance || !attendance.checkInTime) {
      clearPendingGeofenceTimer(userId);
      return res.status(200).json({
        success: true,
        isInside: geofenceResult.isInside,
        distance: geofenceResult.distance,
        allowedRadius: OFFICE_LOCATION.radiusMeters,
        isCheckedIn: false,
        isCheckedOut: false,
        isOnBreak: false,
        autoCheckedOut: false,
        autoLogout: false,
        shouldLogout: false,
        message: geofenceResult.isInside
          ? "Device is inside office radius (<= 70m). User is not checked in."
          : `Device is outside office radius (${geofenceResult.distance}m > 70m). User is not checked in.`,
      });
    }

    if (attendance.checkOutTime) {
      clearPendingGeofenceTimer(userId);
      return res.status(200).json({
        success: true,
        isInside: geofenceResult.isInside,
        distance: geofenceResult.distance,
        allowedRadius: OFFICE_LOCATION.radiusMeters,
        isCheckedIn: true,
        isCheckedOut: true,
        isOnBreak: false,
        autoCheckedOut: !!attendance.autoCheckedOut,
        autoLogout: false,
        shouldLogout: false,
        message: "User is already checked out today.",
        data: formatAttendanceDocument(attendance),
      });
    }

    // Fetch active session if any
    let currentSession = null;
    try {
      const Session = require("../models/Session");
      currentSession = await Session.findOne({
        userId,
        status: { $in: ["active", "break", "break-start", "break_start", "on_break"] },
      }).sort({ createdAt: -1 });
    } catch (_) {}

    // Check for active break or break-start status
    const activeBreak = Array.isArray(attendance.breaks)
      ? attendance.breaks.find((b) => !b.endTime)
      : null;
    const isOnBreak =
      !!activeBreak ||
      attendance.isOnBreak === true ||
      attendance.status === "break" ||
      isBreakStartActive(attendance, currentSession, payload);

    console.log(
      `[Geofence Debug] User: ${userId} | Status: ${attendance.status} | IsOnBreak: ${isOnBreak}`
    );

    // ========================================================
    // IF INSIDE GEOFENCE (<= 70 meters):
    // ========================================================
    if (geofenceResult.isInside) {
      let wasPendingCancelled = false;
      const existing = pendingGeofenceCheckouts.get(userId.toString());
      if (existing?.timer) {
        clearTimeout(existing.timer);
        pendingGeofenceCheckouts.delete(userId.toString());
        wasPendingCancelled = true;
      }
      if (attendance.outsideGeofenceAt) {
        attendance.outsideGeofenceAt = null;
        attendance.outsideGeofenceCountdown = 0;
        await attendance.save();
        wasPendingCancelled = true;
      }

      return res.status(200).json({
        success: true,
        isInside: true,
        distance: geofenceResult.distance,
        allowedRadius: OFFICE_LOCATION.radiusMeters,
        isCheckedIn: true,
        isCheckedOut: false,
        isOnBreak,
        status: isOnBreak ? "break-start" : "checked-in",
        autoCheckedOut: false,
        autoCheckoutPending: false,
        timerCancelled: wasPendingCancelled,
        autoLogout: false,
        shouldLogout: false,
        deviceType,
        message: wasPendingCancelled
          ? "Device returned inside office radius (within 70m). Pending auto-checkout cancelled."
          : "Device is inside office radius (within 70m).",
        data: formatAttendanceDocument(attendance),
      });
    }

    // ========================================================
    // IF OUTSIDE GEOFENCE (> 70 meters) & ON BREAK (BREAK_IN):
    // ========================================================
    if (isOnBreak) {
      clearPendingGeofenceTimer(userId);
      if (attendance.outsideGeofenceAt) {
        attendance.outsideGeofenceAt = null;
        attendance.outsideGeofenceCountdown = 0;
        await attendance.save();
      }

      console.log(
        `[Geofence Debug] User ${userId} is outside 70m (${geofenceResult.distance}m) but status is BREAK_IN. Auto-checkout SKIPPED.`
      );

      return res.status(200).json({
        success: true,
        isInside: false,
        distance: geofenceResult.distance,
        allowedRadius: OFFICE_LOCATION.radiusMeters,
        isCheckedIn: true,
        isCheckedOut: false,
        isOnBreak: true,
        status: "break-start",
        autoCheckedOut: false,
        autoLogout: false,
        shouldLogout: false,
        deviceType,
        message: `Device is outside 70m office radius (${geofenceResult.distance}m away), but status is break-start (BREAK_IN). Auto-checkout skipped.`,
        data: formatAttendanceDocument(attendance),
      });
    }

    // ========================================================
    // IF OUTSIDE GEOFENCE (> 70 meters) & NOT ON BREAK & CHECKED IN:
    // Apply 10-Second Auto-Checkout Timer Rule
    // ========================================================
    const delaySeconds =
      payload.delaySeconds !== undefined
        ? Math.max(0, Number(payload.delaySeconds))
        : GEOFENCE_AUTO_CHECKOUT_DELAY_SECONDS; // 10 seconds

    const isImmediate =
      payload.immediate === true ||
      payload.force === true ||
      payload.immediateCheckout === true ||
      delaySeconds === 0;

    const existingPending = pendingGeofenceCheckouts.get(userId.toString());
    const now = Date.now();

    let breachTime = existingPending?.breachTime || attendance.outsideGeofenceAt;
    if (!breachTime) {
      breachTime = new Date();
      attendance.outsideGeofenceAt = breachTime;
      attendance.outsideGeofenceCountdown = delaySeconds;
      await attendance.save();
    }

    const elapsedSeconds =
      payload.outsideSeconds !== undefined
        ? Number(payload.outsideSeconds)
        : Math.floor((now - new Date(breachTime).getTime()) / 1000);

    // If 10 seconds have elapsed OR immediate checkout requested:
    if (isImmediate || elapsedSeconds >= delaySeconds) {
      clearPendingGeofenceTimer(userId);

      console.log(
        `[Geofence Debug] Triggering AUTO CHECKOUT for User ${userId} | Distance: ${geofenceResult.distance}m > 70m | Reason: OUTSIDE_GEOFENCE`
      );

      const updatedAtt = await executeAutoCheckout({
        attendanceId: attendance._id,
        userId,
        location: geofenceResult,
        deviceType,
        breachTime,
        reason: isImmediate ? "immediate_outside_geofence" : "10_second_geofence_breach",
      });

      return res.status(200).json({
        success: true,
        isInside: false,
        distance: geofenceResult.distance,
        allowedRadius: OFFICE_LOCATION.radiusMeters,
        isCheckedIn: true,
        isCheckedOut: true,
        isOnBreak: false,
        autoCheckedOut: true,
        autoLogout: false,
        shouldLogout: false,
        elapsedSeconds: Math.max(elapsedSeconds, delaySeconds),
        triggeredByDevice: deviceType,
        message: `Auto-checkout triggered: Device is outside 70m office radius (${geofenceResult.distance}m away) for ${delaySeconds} seconds while checked-in and not on break.`,
        data: formatAttendanceDocument(updatedAtt || attendance),
      });
    }

    // Otherwise, 10 seconds haven't elapsed yet (< 10 seconds)
    const remainingMs = Math.max(10, Math.round((delaySeconds - elapsedSeconds) * 1000));
    const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

    // Start background timer if not already running
    if (!existingPending) {
      const timer = setTimeout(async () => {
        try {
          await executeAutoCheckout({
            attendanceId: attendance._id,
            userId,
            location: {
              latitude: geofenceResult.latitude,
              longitude: geofenceResult.longitude,
              distanceFromOffice: geofenceResult.distance,
            },
            deviceType,
            breachTime,
            reason: "10_second_geofence_timeout",
          });
        } catch (timerErr) {
          console.error("10s Auto-checkout background execution error:", timerErr);
        }
      }, remainingMs);

      if (typeof timer.unref === "function") {
        timer.unref();
      }

      pendingGeofenceCheckouts.set(userId.toString(), {
        timer,
        breachTime,
        attendanceId: attendance._id,
        userId,
        deviceType,
        location: geofenceResult,
      });
    }

    return res.status(200).json({
      success: true,
      isInside: false,
      distance: geofenceResult.distance,
      allowedRadius: OFFICE_LOCATION.radiusMeters,
      isCheckedIn: true,
      isCheckedOut: false,
      isOnBreak: false,
      autoCheckedOut: false,
      autoCheckoutPending: true,
      autoCheckoutDelaySeconds: delaySeconds,
      elapsedSeconds,
      remainingSeconds,
      outsideGeofenceAt: breachTime,
      triggeredByDevice: deviceType,
      message: `Device is outside 70m office radius (${geofenceResult.distance}m away). Automatic check-out will occur in ${remainingSeconds} second(s) if device does not return inside 70m radius.`,
      data: formatAttendanceDocument(attendance),
    });
  } catch (err) {
    console.error("Check Location Geofence Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.executeAutoCheckout = executeAutoCheckout;
exports.clearPendingGeofenceTimer = clearPendingGeofenceTimer;
exports.clearAllGeofenceTimers = clearAllGeofenceTimers;
exports.pendingGeofenceCheckouts = pendingGeofenceCheckouts;
exports.isBreakStartActive = isBreakStartActive;

