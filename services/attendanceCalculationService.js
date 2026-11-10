/**
 * Centralized Attendance Calculation Service
 *
 * Provides single source of truth for:
 * - Check-in time status determination (Present, Late, Half-Day, Absent due to late)
 * - Work hours calculation
 * - Attendance status evaluation based on minimum working-hour thresholds:
 *     - Work hours >= presentHours (default 8): "present" (unless check-in capped to half-day)
 *     - Work hours >= halfDayHours (default 4) and < presentHours: "half-day"
 *     - Work hours < halfDayHours (default 4): "absent" (fixes 3-minute / 0.05h bug!)
 * - Integration with approved full-day and half-day leaves
 * - Handling pending leave requests without unfair penalties
 */

const DEFAULT_OFFICE_START_TIME = "09:00";
const DEFAULT_LATE_CUTOFF = "10:10";
const DEFAULT_HALF_DAY_CUTOFF = "10:30";
const DEFAULT_ABSENT_CUTOFF = "15:00";
const DEFAULT_OFFICE_END_TIME = "19:00";
const DEFAULT_PRESENT_HOURS = 8;
const DEFAULT_HALF_DAY_HOURS = 4;
const DEFAULT_BREAK_LIMIT = 60;
const { normalizeLeaveDuration } = require("../utils/leaveUtils");

/**
 * Convert Date or date-string to IST Date object (UTC + 5:30)
 * Note: Use getUTCHours(), getUTCMinutes(), getUTCDate(), etc. on the returned object
 * to read exact IST values independently of local system clock timezone.
 */
const toISTDate = (dateInput = new Date()) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return new Date();
  // IST is exactly UTC + 5.5 hours (330 minutes)
  return new Date(d.getTime() + 5.5 * 3600000);
};

/**
 * Format Date to "YYYY-MM-DD" in IST
 */
const getISTDateString = (dateInput = new Date()) => {
  const ist = toISTDate(dateInput);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Convert time string "HH:mm" into total minutes from midnight
 */
const timeStringToMinutes = (timeStr, fallback = "00:00") => {
  const normalized = typeof timeStr === "string" && timeStr.includes(":") ? timeStr.trim() : fallback;
  const [h, m] = normalized.split(":").map(Number);
  const hour = isNaN(h) ? 0 : Math.min(23, Math.max(0, h));
  const minute = isNaN(m) ? 0 : Math.min(59, Math.max(0, m));
  return hour * 60 + minute;
};

/**
 * Normalize attendance configuration settings with safe fallbacks
 */
const normalizeAttendanceSettings = (source = {}) => {
  const s = source.settings && typeof source.settings === "object" ? source.settings : source;

  return {
    officeStartTime: s.officeStartTime || DEFAULT_OFFICE_START_TIME,
    lateCutoffTime: s.lateCutoffTime || s.lateAfter || s.lateAfterTime || DEFAULT_LATE_CUTOFF,
    halfDayCutoffTime: s.halfDayCutoffTime || s.halfDayAfter || s.halfDayAfterTime || DEFAULT_HALF_DAY_CUTOFF,
    absentCutoffTime: s.absentCutoffTime || s.absentAfter || s.absentAfterTime || DEFAULT_ABSENT_CUTOFF,
    officeEndTime: s.officeEndTime || DEFAULT_OFFICE_END_TIME,
    presentHours: Number(s.presentHours) > 0 ? Number(s.presentHours) : DEFAULT_PRESENT_HOURS,
    halfDayHours: Number(s.halfDayHours) > 0 ? Number(s.halfDayHours) : DEFAULT_HALF_DAY_HOURS,
    breakLimit: Number(s.breakLimit) > 0 ? Number(s.breakLimit) : DEFAULT_BREAK_LIMIT,
  };
};

/**
 * Calculate working hours from check-in and check-out timestamps minus breaks
 * @param {Date|string} checkIn
 * @param {Date|string} checkOut
 * @param {number} breakTimeMinutes
 * @returns {number} hours rounded to 2 decimal places
 */
const getWorkingHours = (checkIn, checkOut, breakTimeMinutes = 0) => {
  if (!checkIn || !checkOut) return 0;
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return 0;

  let totalMinutes = (outDate.getTime() - inDate.getTime()) / (1000 * 60);
  const breakMins = Number(breakTimeMinutes) || 0;
  totalMinutes -= breakMins;

  return Number(Math.max(0, totalMinutes / 60).toFixed(2));
};

/**
 * Determine punctuality and check-in classification based on check-in time in IST
 * @param {Date|string} checkInTime
 * @param {Object} rawSettings
 */
const calculateCheckInStatus = (checkInTime, rawSettings = {}) => {
  if (!checkInTime) {
    return {
      isLate: false,
      isHalfDay: false,
      isAbsentDueToLate: false,
      status: "absent",
    };
  }

  const inDate = new Date(checkInTime);
  if (isNaN(inDate.getTime())) {
    return {
      isLate: false,
      isHalfDay: false,
      isAbsentDueToLate: false,
      status: "absent",
    };
  }

  const settings = normalizeAttendanceSettings(rawSettings);
  const istDate = toISTDate(inDate);
  const checkInMinutes = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();

  const lateCutoffMins = timeStringToMinutes(settings.lateCutoffTime, DEFAULT_LATE_CUTOFF);
  const halfDayCutoffMins = timeStringToMinutes(settings.halfDayCutoffTime, DEFAULT_HALF_DAY_CUTOFF);
  const absentCutoffMins = timeStringToMinutes(settings.absentCutoffTime, DEFAULT_ABSENT_CUTOFF);

  // 1. On Time: checkIn <= lateCutoff
  if (checkInMinutes <= lateCutoffMins) {
    return {
      isLate: false,
      isHalfDay: false,
      isAbsentDueToLate: false,
      status: "present",
    };
  }

  // 2. Late but Full Day eligible: lateCutoff < checkIn <= halfDayCutoff
  if (checkInMinutes <= halfDayCutoffMins) {
    return {
      isLate: true,
      isHalfDay: false,
      isAbsentDueToLate: false,
      status: "present",
    };
  }

  // 3. Half Day eligible: halfDayCutoff < checkIn <= absentCutoff
  if (checkInMinutes <= absentCutoffMins) {
    return {
      isLate: true,
      isHalfDay: true,
      isAbsentDueToLate: false,
      status: "half-day",
    };
  }

  // 4. Absent due to Late: checkIn > absentCutoff (> 3:00 PM)
  return {
    isLate: true,
    isHalfDay: false,
    isAbsentDueToLate: true,
    status: "absent",
  };
};

/**
 * Central attendance status evaluator
 * Applies strict working hour thresholds:
 * - workHours < halfDayHours -> "absent" (Never half-day for 3 minutes!)
 * - workHours >= halfDayHours and < presentHours -> "half-day"
 * - workHours >= presentHours -> "present" (or "half-day" if check-in was late after halfDayCutoff)
 *
 * @param {Object} attendanceData - { checkInTime, checkOutTime, totalWorkTime, totalBreakTime, status }
 * @param {Object} rawSettings - office and threshold settings
 * @param {Object} options - { hasApprovedFullDayLeave, hasApprovedHalfDayLeave, hasPendingLeave, isEvaluationFinal }
 */
const determineAttendanceStatus = (attendanceData = {}, rawSettings = {}, options = {}) => {
  const settings = normalizeAttendanceSettings(rawSettings);

  const {
    checkInTime,
    checkOutTime,
    totalBreakTime = 0,
  } = attendanceData;

  const approvedLeaveIsHalfDay = Boolean(
    options.approvedLeave && normalizeLeaveDuration(options.approvedLeave).isHalfDay,
  );
  const hasApprovedHalfDayLeave = Boolean(
    options.hasApprovedHalfDayLeave || approvedLeaveIsHalfDay,
  );
  const hasApprovedFullDayLeave = Boolean(
    !hasApprovedHalfDayLeave &&
    (options.hasApprovedFullDayLeave || options.approvedLeave || attendanceData.status === "leave")
  );

  const hasPendingLeave = Boolean(options.hasPendingLeave);

  // Case 1: No Check-In
  if (!checkInTime) {
    if (hasApprovedFullDayLeave) {
      return {
        status: "leave",
        isLate: false,
        isAbsentDueToLate: false,
        totalWorkTime: 0,
        pendingLeave: false,
      };
    }

    return {
      status: "absent",
      isLate: false,
      isAbsentDueToLate: false,
      totalWorkTime: 0,
      pendingLeave: hasPendingLeave,
    };
  }

  // Case 2: Check-In is present
  const checkInStatus = calculateCheckInStatus(checkInTime, settings);

  // Calculate work hours
  let workHours = 0;
  if (checkInTime && checkOutTime) {
    workHours = getWorkingHours(checkInTime, checkOutTime, totalBreakTime);
  } else if (attendanceData.totalWorkTime !== undefined && attendanceData.totalWorkTime !== null) {
    workHours = Number(Number(attendanceData.totalWorkTime).toFixed(2));
  }

  const isFinal = Boolean(checkOutTime || options.isEvaluationFinal);

  // In-progress active session (check-out not yet recorded and not final evaluation)
  if (!isFinal) {
    return {
      status: checkInStatus.status,
      isLate: checkInStatus.isLate,
      isAbsentDueToLate: checkInStatus.isAbsentDueToLate,
      totalWorkTime: workHours,
      pendingLeave: hasPendingLeave,
    };
  }

  // Checkout has occurred or final evaluation is requested:
  // If employee checked in after absent cutoff (e.g. after 3:00 PM), remains absent
  if (checkInStatus.isAbsentDueToLate) {
    return {
      status: "absent",
      isLate: true,
      isAbsentDueToLate: true,
      totalWorkTime: workHours,
      pendingLeave: false,
    };
  }

  const presentThreshold = settings.presentHours; // default 8
  const halfDayThreshold = settings.halfDayHours; // default 4

  // CRITICAL THRESHOLD LOGIC:
  // An employee who works only 3 minutes (0.05 hours) must NOT be marked half-day!
  // Any work time below the minimum half-day threshold (4 hours) is classified as absent.
  if (workHours < halfDayThreshold) {
    return {
      status: "absent",
      isLate: checkInStatus.isLate,
      isAbsentDueToLate: false,
      totalWorkTime: workHours,
      pendingLeave: false,
    };
  }

  // Work hours between halfDayThreshold (4h) and presentThreshold (8h)
  if (workHours < presentThreshold) {
    return {
      status: "half-day",
      isLate: checkInStatus.isLate,
      isAbsentDueToLate: false,
      totalWorkTime: workHours,
      halfDayType: checkInStatus.isHalfDay ? "second-half" : "first-half",
      pendingLeave: false,
    };
  }

  // Work hours >= presentThreshold (8h)
  // If check-in time was already after halfDayCutoff (10:30 AM), capped at half-day
  if (checkInStatus.status === "half-day") {
    return {
      status: "half-day",
      isLate: true,
      isAbsentDueToLate: false,
      totalWorkTime: workHours,
      halfDayType: "second-half",
      pendingLeave: false,
    };
  }

  // Fully present
  return {
    status: "present",
    isLate: checkInStatus.isLate,
    isAbsentDueToLate: false,
    totalWorkTime: workHours,
    pendingLeave: false,
  };
};

module.exports = {
  DEFAULT_OFFICE_START_TIME,
  DEFAULT_LATE_CUTOFF,
  DEFAULT_HALF_DAY_CUTOFF,
  DEFAULT_ABSENT_CUTOFF,
  DEFAULT_OFFICE_END_TIME,
  DEFAULT_PRESENT_HOURS,
  DEFAULT_HALF_DAY_HOURS,
  DEFAULT_BREAK_LIMIT,
  toISTDate,
  getISTDateString,
  timeStringToMinutes,
  normalizeAttendanceSettings,
  getWorkingHours,
  calculateCheckInStatus,
  determineAttendanceStatus,
};
