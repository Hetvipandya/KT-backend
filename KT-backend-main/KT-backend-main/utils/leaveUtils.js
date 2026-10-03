const Holiday = require("../models/Holiday");

/**
 * Format a Date object or date string into standard "YYYY-MM-DD" (IST/Local safe).
 * Handles strings like "2026-09-20", ISO strings "2026-09-20T00:00:00.000Z", and Date objects.
 */
const toDateString = (dateInput) => {
  if (!dateInput) return "";

  if (typeof dateInput === "string") {
    // If already in YYYY-MM-DD format (or starts with it)
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";

  // Use local/IST components to avoid UTC shift
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Parse a "YYYY-MM-DD" string into a local Date object at midnight.
 */
const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

/**
 * Centralized calculation of working leave days.
 * Excludes:
 * 1. Sundays (Day 0)
 * 2. Company-declared holidays from Holiday model
 *
 * @param {string|Date} startDate - Leave start date
 * @param {string|Date} endDate - Leave end date
 * @param {boolean} [isHalfDay=false] - Whether it is a half day leave
 * @returns {Promise<{
 *   workingDays: number,
 *   totalDays: number,
 *   totalCalendarDays: number,
 *   excludedSundays: number,
 *   excludedHolidays: number,
 *   workingDates: string[],
 *   excludedDates: Array<{ date: string, reason: string, name?: string }>,
 *   holidayDetails: Array<{ holidayName: string, holidayDate: string }>
 * }>}
 */
const calculateWorkingLeaveDays = async (startDate, endDate, isHalfDay = false) => {
  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate || startDate);

  if (!startStr || !endStr) {
    return {
      workingDays: 0,
      totalDays: 0,
      totalCalendarDays: 0,
      excludedSundays: 0,
      excludedHolidays: 0,
      workingDates: [],
      excludedDates: [],
      holidayDetails: [],
    };
  }

  let start = parseLocalDate(startStr);
  let end = parseLocalDate(endStr);

  // If start is after end, swap them safely
  if (start.getTime() > end.getTime()) {
    const temp = start;
    start = end;
    end = temp;
  }

  // Calculate range bounds for querying Holiday collection
  const queryStart = new Date(start);
  queryStart.setHours(0, 0, 0, 0);
  const queryEnd = new Date(end);
  queryEnd.setHours(23, 59, 59, 999);

  // Fetch all company holidays in the date range
  const holidayRecords = await Holiday.find({
    holidayDate: {
      $gte: new Date(queryStart.getTime() - 24 * 60 * 60 * 1000), // Buffer for timezones
      $lte: new Date(queryEnd.getTime() + 24 * 60 * 60 * 1000),
    },
  });

  // Build a lookup map of Holiday Date strings -> Holiday Details
  const holidayMap = new Map();
  holidayRecords.forEach((h) => {
    const hDateStr = toDateString(h.holidayDate);
    if (hDateStr) {
      holidayMap.set(hDateStr, {
        holidayName: h.holidayName || "Company Holiday",
        holidayDate: hDateStr,
        isPublicHoliday: h.isPublicHoliday ?? true,
      });
    }
  });

  const workingDates = [];
  const excludedDates = [];
  let excludedSundays = 0;
  let excludedHolidays = 0;
  let totalCalendarDays = 0;
  const holidayDetails = [];

  const current = new Date(start);
  while (current.getTime() <= end.getTime()) {
    totalCalendarDays++;
    const currentStr = toDateString(current);
    const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    if (dayOfWeek === 0) {
      // 1. Sunday Exclusion
      excludedSundays++;
      excludedDates.push({
        date: currentStr,
        reason: "Sunday",
      });
    } else if (holidayMap.has(currentStr)) {
      // 2. Company Holiday Exclusion
      excludedHolidays++;
      const hol = holidayMap.get(currentStr);
      excludedDates.push({
        date: currentStr,
        reason: "Company Holiday",
        name: hol.holidayName,
      });
      holidayDetails.push(hol);
    } else {
      // 3. Valid Working Day
      workingDates.push(currentStr);
    }

    // Advance to next day
    current.setDate(current.getDate() + 1);
  }

  let workingDays = workingDates.length;
  if (isHalfDay) {
    workingDays = workingDays > 0 ? 0.5 : 0;
  }

  return {
    workingDays,
    totalDays: workingDays,
    totalCalendarDays,
    excludedSundays,
    excludedHolidays,
    workingDates,
    excludedDates,
    holidayDetails,
  };
};

module.exports = {
  toDateString,
  calculateWorkingLeaveDays,
};
