const Holiday = require("../models/Holiday");
const {
  calculateWorkingLeaveDays,
  normalizeLeaveDuration,
  normalizeHalfDayType,
  validateLeaveDateRange,
} = require("../utils/leaveUtils");

describe("leave duration normalization", () => {
  test.each([
    [{ leaveType: "full_day", isHalfDay: true, halfDayType: "second-half" }, "half_day_2", "second-half"],
    [{ leaveType: "half_day_1" }, "half_day_1", "first-half"],
    [{ leaveType: "half_day_2", isHalfDay: "false" }, "half_day_2", "second-half"],
    [{ leaveType: "paid", is_half_day: "true", half_day_type: "first_half" }, "half_day_1", "first-half"],
    [{ leaveType: "full_day", shift: "PM" }, "half_day_2", "second-half"],
    [{ leaveType: "full_day", isHalfDay: "false" }, "full_day", null],
  ])("normalizes %j", (input, leaveType, halfDayType) => {
    expect(normalizeLeaveDuration(input)).toMatchObject({
      leaveType,
      isHalfDay: Boolean(halfDayType),
      halfDayType,
    });
  });

  test.each([
    ["first_half", "first-half"],
    ["2nd half", "second-half"],
    ["AM", "first-half"],
    ["not-a-shift", null],
  ])("normalizes shift %s", (value, expected) => {
    expect(normalizeHalfDayType(value)).toBe(expected);
  });

  test("requires one date for half-day requests and a working date", async () => {
    expect(validateLeaveDateRange("2026-11-09", "2026-11-10", true).error)
      .toBe("Half-Day Leave must cover exactly one date.");

    jest.spyOn(Holiday, "find").mockResolvedValue([]);
    await expect(calculateWorkingLeaveDays("2026-11-09", "2026-11-09", true))
      .resolves.toMatchObject({ workingDays: 0.5 });

    Holiday.find.mockResolvedValue([
      { holidayDate: new Date("2026-11-09T12:00:00.000Z"), holidayName: "Company Holiday" },
    ]);
    await expect(calculateWorkingLeaveDays("2026-11-09", "2026-11-09", true))
      .resolves.toMatchObject({ workingDays: 0 });
    expect(Holiday.find).toHaveBeenCalledTimes(2);
  });
});
