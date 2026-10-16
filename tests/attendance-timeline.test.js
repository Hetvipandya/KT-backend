const { buildAttendanceTimeline } = require("../utils/attendanceTimeline");

describe("attendance timeline", () => {
  test("uses the approved check-in and creates work and break bar segments", () => {
    const timeline = buildAttendanceTimeline({
      date: "2026-10-16",
      checkInTime: null,
      approvedCheckInTime: new Date("2026-10-16T04:30:00.000Z"),
      checkOutTime: new Date("2026-10-16T12:30:00.000Z"),
      breaks: [
        {
          startTime: new Date("2026-10-16T07:00:00.000Z"),
          endTime: new Date("2026-10-16T07:30:00.000Z"),
        },
      ],
      status: "present",
    });

    expect(timeline.effectiveCheckInTime).toEqual(
      new Date("2026-10-16T04:30:00.000Z"),
    );
    expect(timeline.timelineSegments).toEqual([
      {
        type: "blue",
        label: "Working Time",
        fromMinutes: 600,
        toMinutes: 750,
      },
      {
        type: "yellow",
        label: "Break Time",
        fromMinutes: 750,
        toMinutes: 780,
      },
      {
        type: "blue",
        label: "Working Time",
        fromMinutes: 780,
        toMinutes: 1080,
      },
      {
        type: "grey",
        label: "Checked Out / Non-working",
        fromMinutes: 1080,
        toMinutes: 1140,
      },
    ]);
    expect(timeline.timelineEvents.map(({ type }) => type)).toEqual([
      "check-in",
      "break-start",
      "break-end",
      "check-out",
    ]);
  });

  test("returns adjustment and checkout log events when no check-in exists", () => {
    const timeline = buildAttendanceTimeline({
      date: "2026-10-16",
      checkInTime: null,
      approvedCheckInTime: null,
      checkOutTime: new Date("2026-10-16T12:30:00.000Z"),
      breaks: [],
      adjustmentReason: "Check-in was not recorded",
      updatedAt: new Date("2026-10-16T13:00:00.000Z"),
      status: "present",
    });

    expect(timeline.timelineSegments).toEqual([
      {
        type: "grey",
        label: "No check-in recorded",
        fromMinutes: 600,
        toMinutes: 1140,
      },
    ]);
    expect(timeline.timelineEvents).toEqual([
      expect.objectContaining({ type: "check-out" }),
      expect.objectContaining({
        type: "adjustment",
        label: "Attendance adjusted",
        description: "Check-in was not recorded",
      }),
    ]);
  });
});
