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
    assert.strictEqual(result.excludedSaturdays, 0, "No Saturday holidays in this period");
    assert.strictEqual(result.excludedHolidays, 0, "No holidays");
  });

  test("2. 2nd and 4th Saturday Exclusion Tests", async () => {
    // 10 Oct 2026 (2nd Saturday)
    const secondSat = await calculateWorkingLeaveDays("2026-10-10", "2026-10-10");
    assert.strictEqual(secondSat.workingDays, 0, "2nd Saturday should be 0 working days");
    assert.strictEqual(secondSat.excludedSaturdays, 1, "1 Saturday excluded");
    assert.strictEqual(secondSat.excludedDates[0].reason, "2nd Saturday");

    // 24 Oct 2026 (4th Saturday)
    const fourthSat = await calculateWorkingLeaveDays("2026-10-24", "2026-10-24");
    assert.strictEqual(fourthSat.workingDays, 0, "4th Saturday should be 0 working days");
    assert.strictEqual(fourthSat.excludedSaturdays, 1, "1 Saturday excluded");
    assert.strictEqual(fourthSat.excludedDates[0].reason, "4th Saturday");

    // 3 Oct 2026 (1st Saturday) - Should be working day
    const firstSat = await calculateWorkingLeaveDays("2026-10-03", "2026-10-03");
    assert.strictEqual(firstSat.workingDays, 1, "1st Saturday should be 1 working day");

    // 17 Oct 2026 (3rd Saturday) - Should be working day
    const thirdSat = await calculateWorkingLeaveDays("2026-10-17", "2026-10-17");
    assert.strictEqual(thirdSat.workingDays, 1, "3rd Saturday should be 1 working day");
  });

  test("3. Leave containing 1 holiday & 2nd Saturday & Sunday (User example: 10 Oct to 14 Oct)", async () => {
    // 12 Oct 2026 (Monday) is Dussehra
    holidayStore.push({
      holidayName: "Dussehra",
      holidayDate: new Date("2026-10-12T00:00:00.000Z"),
      isPublicHoliday: true,
    });

    // 10 Oct (2nd Sat), 11 Oct (Sun), 12 Oct (Mon - Holiday), 13 Oct (Tue), 14 Oct (Wed)
    const result = await calculateWorkingLeaveDays("2026-10-10", "2026-10-14");
    assert.strictEqual(result.totalCalendarDays, 5, "5 total calendar days");
    assert.strictEqual(result.excludedSaturdays, 1, "1 Saturday (10 Oct) excluded");
    assert.strictEqual(result.excludedSundays, 1, "1 Sunday (11 Oct) excluded");
    assert.strictEqual(result.excludedHolidays, 1, "1 Holiday (12 Oct) excluded");
    assert.strictEqual(result.workingDays, 2, "2 working days deducted (13, 14 Oct)");
  });

  test("4. Leave containing multiple holidays and weekend exclusions", async () => {
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
    assert.strictEqual(result.excludedSaturdays, 1, "1 Saturday (10 Oct)");
    assert.strictEqual(result.excludedSundays, 1, "1 Sunday (11 Oct)");
    assert.strictEqual(result.excludedHolidays, 2, "2 Holidays (12, 13 Oct) excluded");
    assert.strictEqual(result.workingDays, 1, "1 working day deducted (14 Oct)");
  });

  test("5. Leave starting on a holiday", async () => {
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

  test("6. Leave ending on a holiday", async () => {
    holidayStore.push({
      holidayName: "Dussehra",
      holidayDate: new Date("2026-10-12T00:00:00.000Z"),
      isPublicHoliday: true,
    });

    // Leave 10 Oct (2nd Sat) to 12 Oct (Mon - Holiday)
    const result = await calculateWorkingLeaveDays("2026-10-10", "2026-10-12");
    assert.strictEqual(result.excludedSaturdays, 1, "10 Oct 2nd Saturday");
    assert.strictEqual(result.excludedSundays, 1, "11 Oct Sunday");
    assert.strictEqual(result.excludedHolidays, 1, "12 Oct Holiday");
    assert.strictEqual(result.workingDays, 0, "0 working days");
  });

  test("7. Leave period containing ONLY holidays and week-offs", async () => {
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

  test("8. Half-day leave calculation on 2nd Saturday and working day", async () => {
    holidayStore.push({
      holidayName: "Dussehra",
      holidayDate: new Date("2026-10-12T00:00:00.000Z"),
      isPublicHoliday: true,
    });

    // Half day on working day (14 Oct)
    const workingHalfDay = await calculateWorkingLeaveDays("2026-10-14", "2026-10-14", true);
    assert.strictEqual(workingHalfDay.workingDays, 0.5, "Half day on working day should be 0.5");

    // Half day on 2nd Saturday (10 Oct)
    const satHalfDay = await calculateWorkingLeaveDays("2026-10-10", "2026-10-10", true);
    assert.strictEqual(satHalfDay.workingDays, 0, "Half day on 2nd Saturday should be 0");
  });

  test("9. Cross-month leave calculation with 4th Saturday", async () => {
    holidayStore.push({
      holidayName: "Halloween",
      holidayDate: new Date("2026-10-31T00:00:00.000Z"),
      isPublicHoliday: true,
    });

    // 23 Oct to 27 Oct 2026 (23 Fri, 24 Oct 4th Sat, 25 Oct Sun, 26 Oct Mon, 27 Oct Tue)
    const result = await calculateWorkingLeaveDays("2026-10-23", "2026-10-27");
    assert.strictEqual(result.totalCalendarDays, 5, "5 total calendar days");
    assert.strictEqual(result.excludedSaturdays, 1, "24 Oct 4th Saturday");
    assert.strictEqual(result.excludedSundays, 1, "25 Oct Sunday");
    assert.strictEqual(result.workingDays, 3, "3 working days (23 Oct, 26 Oct, 27 Oct)");
  });

  test("10. Cross-year leave calculation", async () => {
    holidayStore.push({
      holidayName: "New Year",
      holidayDate: new Date("2027-01-01T00:00:00.000Z"),
      isPublicHoliday: true,
    });

    // 30 Dec 2026 (Wed) to 2 Jan 2027 (30 Wed, 31 Thu, 1 Fri-Holiday, 2 Sat 1st Sat)
    const result = await calculateWorkingLeaveDays("2026-12-30", "2027-01-02");
    assert.strictEqual(result.totalCalendarDays, 4, "4 calendar days");
    assert.strictEqual(result.excludedHolidays, 1, "1 Jan Holiday");
    assert.strictEqual(result.excludedSaturdays, 0, "2 Jan 2027 is 1st Saturday");
  });
});

