const IST_OFFSET_MINUTES = 5 * 60 + 30;
const istTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
});

const toValidDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getISTMinutes = (value) => {
  const date = toValidDate(value);
  if (!date) return null;

  const istDate = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  return istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
};

const getISTDateString = (value) => {
  const date = toValidDate(value);
  if (!date) return null;

  const istDate = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatISTTime = (value) => {
  const date = toValidDate(value);
  if (!date) return null;

  return istTimeFormatter.format(date);
};

const buildAttendanceTimeline = (attendance, now = new Date()) => {
  const checkInTime =
    attendance.approvedCheckInTime || attendance.checkInTime || null;
  const events = [];
  const addEvent = (type, label, timestamp, description) => {
    const date = toValidDate(timestamp);
    if (!date) return;

    events.push({
      type,
      label,
      timestamp: date.toISOString(),
      timeDisplay: formatISTTime(date),
      ...(description ? { description } : {}),
    });
  };

  addEvent("check-in", "Check in", checkInTime);

  const breaks = (attendance.breaks || [])
    .map((breakItem) => ({
      ...breakItem,
      startDate: toValidDate(breakItem.startTime),
      endDate: toValidDate(breakItem.endTime),
    }))
    .filter((breakItem) => breakItem.startDate)
    .sort((a, b) => a.startDate - b.startDate);

  breaks.forEach((breakItem) => {
    addEvent("break-start", "Break started", breakItem.startDate);
    addEvent("break-end", "Break ended", breakItem.endDate);
  });

  addEvent("check-out", "Check out", attendance.checkOutTime);

  if (
    attendance.adjustmentReason ||
    (!attendance.checkInTime && attendance.approvalStatus === "approved")
  ) {
    addEvent(
      "adjustment",
      "Attendance adjusted",
      attendance.updatedAt || attendance.createdAt,
      attendance.adjustmentReason,
    );
  }

  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  let workWindowStart = 10 * 60;
  let workWindowEnd = 19 * 60;
  if (attendance.halfDayType === "first-half") {
    workWindowEnd = 14 * 60;
  } else if (attendance.halfDayType === "second-half") {
    workWindowStart = 14 * 60;
  }

  const segments = [];
  const addSegment = (type, label, fromMinutes, toMinutes) => {
    const from = Math.max(workWindowStart, fromMinutes);
    const to = Math.min(workWindowEnd, toMinutes);
    if (to > from) segments.push({ type, label, fromMinutes: from, toMinutes: to });
  };

  const checkInMinutes = getISTMinutes(checkInTime);
  if (checkInMinutes === null) {
    addSegment(
      "grey",
      attendance.status === "absent"
        ? "Absent / Non-working"
        : "No check-in recorded",
      workWindowStart,
      workWindowEnd,
    );
  } else {
    if (checkInMinutes > workWindowStart) {
      addSegment(
        "grey",
        "Non-working / Pre-checkin",
        workWindowStart,
        checkInMinutes,
      );
    }

    let currentPointer = Math.max(workWindowStart, checkInMinutes);
    const nowMinutes = getISTMinutes(now) ?? workWindowEnd;
    const checkoutMinutes = getISTMinutes(attendance.checkOutTime);
    const shiftEnd =
      checkoutMinutes ??
      (attendance.date === getISTDateString(now)
        ? Math.min(workWindowEnd, nowMinutes)
        : workWindowEnd);

    breaks.forEach((breakItem) => {
      const breakStart = getISTMinutes(breakItem.startDate);
      const breakEnd = getISTMinutes(breakItem.endDate);
      if (breakStart === null || breakStart < currentPointer) return;

      addSegment("blue", "Working Time", currentPointer, breakStart);
      if (breakEnd !== null) {
        addSegment("yellow", "Break Time", breakStart, breakEnd);
        currentPointer = Math.max(currentPointer, breakEnd);
      } else {
        const activeBreakEnd = Math.min(workWindowEnd, nowMinutes);
        addSegment("yellow", "Active Break", breakStart, activeBreakEnd);
        currentPointer = activeBreakEnd;
      }
    });

    addSegment("blue", "Working Time", currentPointer, shiftEnd);
    if (shiftEnd < workWindowEnd) {
      addSegment(
        "grey",
        "Checked Out / Non-working",
        shiftEnd,
        workWindowEnd,
      );
    }
  }

  return {
    effectiveCheckInTime: checkInTime,
    timelineEvents: events,
    timelineSegments: segments,
  };
};

module.exports = { buildAttendanceTimeline };
