const assert = require("assert");
const Holiday = require("../models/Holiday");
const { calculateWorkingLeaveDays, toDateString } = require("../utils/leaveUtils");

describe("Holiday Exclusion Rule & Leave Days Calculation Tests", () => {
  let holidayStore = [];

  beforeEach(() => {
    holidayStore = [];
    // Mock Holiday.find to return store records matching date filter
    jest.spyOn(Holiday, "find").mockImplementation(({ holidayDate }) => {
      const gte = holidayDate?.$gte ? new Date(holidayDate.$gte) : null;
      const lte = holidayDate?.$lte ? new Date(holidayDate.$lte) : null;

      const matching = holidayStore.filter((h) => {
        const d = new Date(h.holidayDate);
        if (gte && d < gte) return false;
        if (lte && d > lte) return false;
        return true;
      });

      return Promise.resolve(matching);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("1. Leave without holidays (5 working days Mon-Fri)", async () => {
    // 2026-10-05 (Mon) to 2026-10-09 (Fri)
    const result = await calculateWorkingLeaveDays("2026-10-05", "2026-10-09");
    assert.strictEqual(result.workingDays, 5, "Should equal 5 working days");
    assert.strictEqual(result.totalCalendarDays, 5, "Total calendar days should be 5");
    assert.strictEqual(result.excludedSundays, 0, "No Sundays");
    assert.strictEqual(result.excludedHolidays, 0, "No holidays");
  });

  test("2. Leave containing 1 holiday (User example: 10 Oct to 14 Oct, 12 Oct is Holiday)", async () => {
    // 12 Oct 2026 (Monday) is Dussehra
    holidayStore.push({
      holidayName: "Dussehra",
      holidayDate: new Date("2026-10-12T00:00:00.000Z"),
      isPublicHoliday: true,
    });

    // 10 Oct (Sat), 11 Oct (Sun), 12 Oct (Mon - Holiday), 13 Oct (Tue), 14 Oct (Wed)
    const result = await calculateWorkingLeaveDays("2026-10-10", "2026-10-14");
    assert.strictEqual(result.totalCalendarDays, 5, "5 total calendar days");
    assert.strictEqual(result.excludedSundays, 1, "1 Sunday (11 Oct) excluded");
    assert.strictEqual(result.excludedHolidays, 1, "1 Holiday (12 Oct) excluded");
    assert.strictEqual(result.workingDays, 3, "3 working days deducted (10, 13, 14 Oct)");
  });

  test("3. Leave containing multiple holidays", async () => {
    holidayStore.push(
      {
        holidayName: "Dussehra",
        holidayDate: new Date("2026-10-12T00:00:00.000Z"),
        isPublicHoliday: true,
      },
      {
        holidayName: "Diwali",
        holidayDate: new Date("2026-10-13T00:00:00.000Z"),
        isPublicHoliday: true,
      }
    );

    const result = await calculateWorkingLeaveDays("2026-10-10", "2026-10-14");
    assert.strictEqual(result.excludedHolidays, 2, "2 Holidays (12, 13 Oct) excluded");
    assert.strictEqual(result.workingDays, 2, "2 working days deducted (10, 14 Oct)");
  });

  test("4. Leave starting on a holiday", async () => {
    holidayStore.push(
      {
        holidayName: "Dussehra",
        holidayDate: new Date("2026-10-12T00:00:00.000Z"),
        isPublicHoliday: true,
      },
      {
        holidayName: "Diwali",
        holidayDate: new Date("2026-10-13T00:00:00.000Z"),
        isPublicHoliday: true,
      }
    );

    // Leave 12 Oct (Holiday) to 14 Oct
    const result = await calculateWorkingLeaveDays("2026-10-12", "2026-10-14");
    assert.strictEqual(result.excludedHolidays, 2, "12 and 13 Oct excluded");
    assert.strictEqual(result.workingDays, 1, "Only 14 Oct working day");
  });

  test("5. Leave ending on a holiday", async () => {
    holidayStore.push({
      holidayName: "Dussehra",
      holidayDate: new Date("2026-10-12T00:00:00.000Z"),
      isPublicHoliday: true,
    });

    // Leave 10 Oct (Sat) to 12 Oct (Mon - Holiday)
    const result = await calculateWorkingLeaveDays("2026-10-10", "2026-10-12");
    assert.strictEqual(result.excludedSundays, 1, "11 Oct Sunday");
    assert.strictEqual(result.excludedHolidays, 1, "12 Oct Holiday");
    assert.strictEqual(result.workingDays, 1, "Only 10 Oct working day");
  });

  test("6. Leave period containing ONLY holidays", async () => {
    holidayStore.push(
      {
        holidayName: "Dussehra",
        holidayDate: new Date("2026-10-12T00:00:00.000Z"),
        isPublicHoliday: true,
      },
      {
        holidayName: "Diwali",
        holidayDate: new Date("2026-10-13T00:00:00.000Z"),
        isPublicHoliday: true,
      }
    );

    // Leave 12 Oct to 13 Oct (both holidays)
    const result = await calculateWorkingLeaveDays("2026-10-12", "2026-10-13");
    assert.strictEqual(result.excludedHolidays, 2, "2 holidays excluded");
    assert.strictEqual(result.workingDays, 0, "0 working days");
    assert.strictEqual(result.totalDays, 0, "0 total days");
  });

  test("7. Leave period containing holidays + week-offs (Sunday + Holiday)", async () => {
    holidayStore.push({
      holidayName: "Dussehra",
      holidayDate: new Date("2026-10-12T00:00:00.000Z"),
      isPublicHoliday: true,
    });

    // 11 Oct (Sunday) to 12 Oct (Holiday)
    const result = await calculateWorkingLeaveDays("2026-10-11", "2026-10-12");
    assert.strictEqual(result.excludedSundays, 1, "1 Sunday excluded");
    assert.strictEqual(result.excludedHolidays, 1, "1 Holiday excluded");
    assert.strictEqual(result.workingDays, 0, "0 working days");
  });

  test("8. Half-day leave calculation", async () => {
    holidayStore.push({
      holidayName: "Dussehra",
      holidayDate: new Date("2026-10-12T00:00:00.000Z"),
      isPublicHoliday: true,
    });

    // Half day on working day (14 Oct)
    const workingHalfDay = await calculateWorkingLeaveDays("2026-10-14", "2026-10-14", true);
    assert.strictEqual(workingHalfDay.workingDays, 0.5, "Half day on working day should be 0.5");

    // Half day on a holiday (12 Oct)
    const holidayHalfDay = await calculateWorkingLeaveDays("2026-10-12", "2026-10-12", true);
    assert.strictEqual(holidayHalfDay.workingDays, 0, "Half day on holiday should be 0");
  });

  test("9. Cross-month leave calculation", async () => {
    holidayStore.push({
      holidayName: "Halloween",
      holidayDate: new Date("2026-10-31T00:00:00.000Z"),
      isPublicHoliday: true,
    });

    // 29 Oct to 2 Nov 2026 (29 Thu, 30 Fri, 31 Sat-Holiday, 1 Sun, 2 Mon)
    const result = await calculateWorkingLeaveDays("2026-10-29", "2026-11-02");
    assert.strictEqual(result.totalCalendarDays, 5, "5 total calendar days");
    assert.strictEqual(result.excludedSundays, 1, "1 Nov Sunday");
    assert.strictEqual(result.excludedHolidays, 1, "31 Oct Holiday");
    assert.strictEqual(result.workingDays, 3, "3 working days (29 Oct, 30 Oct, 2 Nov)");
  });

  test("10. Cross-year leave calculation", async () => {
    holidayStore.push({
      holidayName: "New Year",
      holidayDate: new Date("2027-01-01T00:00:00.000Z"),
      isPublicHoliday: true,
    });

    // 30 Dec 2026 to 2 Jan 2027 (30 Wed, 31 Thu, 1 Fri-Holiday, 2 Sat)
    const result = await calculateWorkingLeaveDays("2026-12-30", "2027-01-02");
    assert.strictEqual(result.totalCalendarDays, 4, "4 calendar days");
    assert.strictEqual(result.excludedHolidays, 1, "1 Jan Holiday");
    assert.strictEqual(result.workingDays, 3, "3 working days");
  });
});
