const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../models/User");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const Holiday = require("../models/Holiday");
const AttendanceJobLog = require("../models/AttendanceJobLog");
const SalaryStructure = require("../models/SalaryStructure");

const {
  determineAttendanceStatus,
  calculateCheckInStatus,
  getWorkingHours,
  toISTDate,
  getISTDateString,
} = require("../services/attendanceCalculationService");

const {
  runDailyAttendanceFinalization,
  startAttendanceScheduler,
  stopAttendanceScheduler,
  getMsUntilNextIST4PM,
} = require("../services/attendanceScheduler.service");

const { calculateMonthlyPayroll } = require("../services/payrollCalculationService");
const attendanceRoutes = require("../routes/attendanceRoutes");


const makeToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), userId: user._id.toString(), role: user.role },
    process.env.JWT_SECRET || "kevalonTechnology",
    { expiresIn: "1h" }
  );
};

describe("Automatic Daily Attendance Finalization & Scheduler Test Suite", () => {
  let mongoServer;
  let app;
  let adminUser;
  let hrUser;
  let employeeUser1;
  let employeeUser2;
  let employeeUser3;
  let futureEmployee;
  let deactivatedEmployee;
  let currentAuthUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Seed test users
    adminUser = await User.create({
      name: "Admin User",
      email: "admin@kevalon.com",
      password: "password123",
      phoneNumber: "9876543001",
      role: "admin",
      isApproved: true,
      isActive: true,
      isDeactivated: false,
      status: "Active",
    });

    hrUser = await User.create({
      name: "HR Manager",
      email: "hr@kevalon.com",
      password: "password123",
      phoneNumber: "9876543002",
      role: "hr",
      isApproved: true,
      isActive: true,
      isDeactivated: false,
      status: "Active",
    });

    employeeUser1 = await User.create({
      name: "Rahul Sharma",
      email: "rahul@kevalon.com",
      password: "password123",
      phoneNumber: "9876543003",
      role: "employee",
      isApproved: true,
      isActive: true,
      isDeactivated: false,
      status: "Active",
    });
    await Employee.create({
      userID: employeeUser1._id,
      name: "Rahul Sharma",
      email: "rahul@kevalon.com",
      employeeStatus: "Active",
      joiningDate: new Date("2026-01-01"),
    });

    employeeUser2 = await User.create({
      name: "Pooja Patel",
      email: "pooja@kevalon.com",
      password: "password123",
      phoneNumber: "9876543004",
      role: "employee",
      isApproved: true,
      isActive: true,
      isDeactivated: false,
      status: "Active",
    });
    await Employee.create({
      userID: employeeUser2._id,
      name: "Pooja Patel",
      email: "pooja@kevalon.com",
      employeeStatus: "Active",
      joiningDate: new Date("2026-01-01"),
    });

    employeeUser3 = await User.create({
      name: "Amit Verma",
      email: "amit@kevalon.com",
      password: "password123",
      phoneNumber: "9876543005",
      role: "employee",
      isApproved: true,
      isActive: true,
      isDeactivated: false,
      status: "Active",
    });
    await Employee.create({
      userID: employeeUser3._id,
      name: "Amit Verma",
      email: "amit@kevalon.com",
      employeeStatus: "Active",
      joiningDate: new Date("2026-01-01"),
    });

    // Employee joining in the future (after 2026-11-09)
    futureEmployee = await User.create({
      name: "Future Joiner",
      email: "future@kevalon.com",
      password: "password123",
      phoneNumber: "9876543006",
      role: "employee",
      isApproved: true,
      isActive: true,
      isDeactivated: false,
      status: "Active",
    });
    await Employee.create({
      userID: futureEmployee._id,
      name: "Future Joiner",
      email: "future@kevalon.com",
      employeeStatus: "Active",
      joiningDate: new Date("2026-11-20"),
    });

    // Deactivated employee
    deactivatedEmployee = await User.create({
      name: "Ex Employee",
      email: "ex@kevalon.com",
      password: "password123",
      phoneNumber: "9876543007",
      role: "employee",
      isApproved: true,
      isActive: false,
      isDeactivated: true,
      status: "Inactive",
    });
    await Employee.create({
      userID: deactivatedEmployee._id,
      name: "Ex Employee",
      email: "ex@kevalon.com",
      employeeStatus: "Inactive",
      isDeactivated: true,
      joiningDate: new Date("2026-01-01"),
    });

    // Setup Express App
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = currentAuthUser || adminUser;
      next();
    });

    app.use("/api/attendance", attendanceRoutes);
  });

  afterAll(async () => {
    stopAttendanceScheduler();
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    currentAuthUser = null;
    await Attendance.deleteMany({});
    await Leave.deleteMany({});
    await Holiday.deleteMany({});
    await AttendanceJobLog.deleteMany({});
  });

  // =========================================================================
  // 1. CRITICAL TEST CASE: 3-MINUTE ATTENDANCE CLASSIFICATION & THRESHOLDS
  // =========================================================================
  describe("1. Critical Test Case & Minimum Working-Hour Thresholds", () => {
    test("1.1 Critical Test Case: 3 minutes (0.05 hours) work must be classified as 'absent', NOT 'half-day'", () => {
      // Date: 2026-11-05
      // Check-in: 2026-11-05T10:14:00.000Z
      // Check-out: 2026-11-05T10:17:00.000Z
      // Total Work Time: 0.05 hours
      const checkInTime = new Date("2026-11-05T10:14:00.000Z");
      const checkOutTime = new Date("2026-11-05T10:17:00.000Z");

      const hours = getWorkingHours(checkInTime, checkOutTime, 0);
      expect(hours).toBe(0.05);

      const result = determineAttendanceStatus(
        {
          checkInTime,
          checkOutTime,
          totalWorkTime: hours,
        },
        {
          presentHours: 8,
          halfDayHours: 4,
          lateCutoffTime: "10:10",
          halfDayCutoffTime: "10:30",
          absentCutoffTime: "15:00",
        },
        { isEvaluationFinal: true }
      );

      // EXPECTED: "absent" because 0.05 hours < minimum half-day threshold (4.0 hours)
      expect(result.status).toBe("absent");
      expect(result.totalWorkTime).toBe(0.05);
    });

    test("1.2 Threshold behavior across working-hour spectrum", () => {
      const checkInOnTime = new Date("2026-11-05T04:00:00.000Z"); // 04:00 UTC = 09:30 AM IST (On time)

      // 3.9 hours -> Below half-day threshold (4h) => "absent"
      const res39 = determineAttendanceStatus(
        { checkInTime: checkInOnTime, totalWorkTime: 3.9 },
        { presentHours: 8, halfDayHours: 4 },
        { isEvaluationFinal: true }
      );
      expect(res39.status).toBe("absent");

      // Exactly 4.0 hours -> Meets half-day threshold => "half-day"
      const res40 = determineAttendanceStatus(
        { checkInTime: checkInOnTime, totalWorkTime: 4.0 },
        { presentHours: 8, halfDayHours: 4 },
        { isEvaluationFinal: true }
      );
      expect(res40.status).toBe("half-day");

      // 7.5 hours -> Between 4h and 8h => "half-day"
      const res75 = determineAttendanceStatus(
        { checkInTime: checkInOnTime, totalWorkTime: 7.5 },
        { presentHours: 8, halfDayHours: 4 },
        { isEvaluationFinal: true }
      );
      expect(res75.status).toBe("half-day");

      // Exactly 8.0 hours on time => "present"
      const res80 = determineAttendanceStatus(
        { checkInTime: checkInOnTime, totalWorkTime: 8.0 },
        { presentHours: 8, halfDayHours: 4 },
        { isEvaluationFinal: true }
      );
      expect(res80.status).toBe("present");
    });

    test("1.3 Late check-in capping: Check-in after 10:30 AM capped to half-day even with 8 hours worked", () => {
      // 11:00 AM IST check-in
      const checkIn11AM = new Date("2026-11-05T05:30:00.000Z"); // 05:30 UTC = 11:00 AM IST

      const res = determineAttendanceStatus(
        { checkInTime: checkIn11AM, totalWorkTime: 8.5 },
        { presentHours: 8, halfDayHours: 4, halfDayCutoffTime: "10:30", absentCutoffTime: "15:00" },
        { isEvaluationFinal: true }
      );

      expect(res.status).toBe("half-day");
      expect(res.isLate).toBe(true);
    });

    test("1.4 Absent due to late: Check-in after 3:00 PM IST is always absent", () => {
      // 3:30 PM IST check-in
      const checkIn330PM = new Date("2026-11-05T10:00:00.000Z"); // 10:00 UTC = 15:30 IST

      const res = determineAttendanceStatus(
        { checkInTime: checkIn330PM, totalWorkTime: 2.0 },
        { presentHours: 8, halfDayHours: 4, absentCutoffTime: "15:00" },
        { isEvaluationFinal: true }
      );

      expect(res.status).toBe("absent");
      expect(res.isAbsentDueToLate).toBe(true);
    });
  });

  // =========================================================================
  // 2. DAILY 4:00 PM FINALIZATION SCHEDULER ENGINE
  // =========================================================================
  describe("2. Daily 4:00 PM Finalization Scheduler Engine", () => {
    test("2.1 Marks active employees absent on a working day if no check-in exists", async () => {
      // Date: 2026-11-09 (Monday - Working day)
      const targetDate = "2026-11-09";

      const result = await runDailyAttendanceFinalization({
        targetDate,
        executionType: "SCHEDULED",
        dryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.summary.markedAbsent).toBe(3); // rahul, pooja, amit
      expect(result.summary.skippedFutureJoiners).toBe(1); // futureEmployee skipped

      // Verify Attendance records created in DB
      const rahulAtt = await Attendance.findOne({ userId: employeeUser1._id, date: targetDate });
      expect(rahulAtt).not.toBeNull();
      expect(rahulAtt.status).toBe("absent");
      expect(rahulAtt.approvalStatus).toBe("approved");
      expect(rahulAtt.totalWorkTime).toBe(0);

      // Verify Job Log persisted
      const log = await AttendanceJobLog.findOne({ date: targetDate });
      expect(log).not.toBeNull();
      expect(log.status).toBe("SUCCESS");
      expect(log.summary.markedAbsent).toBe(3);
    });

    test("2.2 PRESERVES existing punches and never overwrites them", async () => {
      const targetDate = "2026-11-09";

      // Rahul checked in at 09:30 AM
      await Attendance.create({
        userId: employeeUser1._id,
        userType: "employee",
        date: targetDate,
        checkInTime: new Date("2026-11-09T04:00:00.000Z"), // 09:30 AM IST
        status: "present",
        totalWorkTime: 0,
      });

      const result = await runDailyAttendanceFinalization({
        targetDate,
        executionType: "SCHEDULED",
        dryRun: false,
      });

      expect(result.summary.checkedIn).toBe(1);
      expect(result.summary.markedAbsent).toBe(2); // Only pooja and amit

      // Verify Rahul's record was preserved
      const rahulAtt = await Attendance.findOne({ userId: employeeUser1._id, date: targetDate });
      expect(rahulAtt.status).toBe("present");
      expect(rahulAtt.checkInTime).not.toBeNull();
    });

    test("2.3 PRESERVES authorized attendance adjustments", async () => {
      const targetDate = "2026-11-09";

      // Pooja has an approved adjustment
      await Attendance.create({
        userId: employeeUser2._id,
        userType: "employee",
        date: targetDate,
        status: "present",
        approvalStatus: "approved",
        adjustmentReason: "Client on-site visit authorized",
      });

      const result = await runDailyAttendanceFinalization({
        targetDate,
        executionType: "SCHEDULED",
        dryRun: false,
      });

      expect(result.summary.approvedAdjustments).toBe(1);
      const poojaAtt = await Attendance.findOne({ userId: employeeUser2._id, date: targetDate });
      expect(poojaAtt.status).toBe("present");
      expect(poojaAtt.adjustmentReason).toBe("Client on-site visit authorized");
    });

    test("2.4 PRESERVES approved full-day leave and creates status: 'leave'", async () => {
      const targetDate = "2026-11-09";

      // Rahul has approved full-day leave
      await Leave.create({
        employeeId: employeeUser1._id,
        applicantRole: "employee",
        leaveType: "sick",
        startDate: new Date("2026-11-09T00:00:00.000Z"),
        endDate: new Date("2026-11-09T23:59:59.000Z"),
        totalDays: 1,
        reason: "Viral fever",
        status: "approved",
      });

      const result = await runDailyAttendanceFinalization({
        targetDate,
        executionType: "SCHEDULED",
        dryRun: false,
      });

      expect(result.summary.preservedLeaves).toBe(1);

      const rahulAtt = await Attendance.findOne({ userId: employeeUser1._id, date: targetDate });
      expect(rahulAtt.status).toBe("leave");
      expect(rahulAtt.approvalStatus).toBe("approved");
    });

    test("2.5 Handles approved half-day leave: marks unworked portion absent without double penalty", async () => {
      const targetDate = "2026-11-09";

      // Pooja has approved half-day leave
      await Leave.create({
        employeeId: employeeUser2._id,
        applicantRole: "employee",
        leaveType: "half_day_1",
        isHalfDay: true,
        halfDayType: "first-half",
        startDate: new Date("2026-11-09T00:00:00.000Z"),
        endDate: new Date("2026-11-09T23:59:59.000Z"),
        totalDays: 0.5,
        reason: "Dentist appointment",
        status: "approved",
      });

      const result = await runDailyAttendanceFinalization({
        targetDate,
        executionType: "SCHEDULED",
        dryRun: false,
      });

      expect(result.summary.preservedHalfDayLeaves).toBe(1);

      const poojaAtt = await Attendance.findOne({ userId: employeeUser2._id, date: targetDate });
      expect(poojaAtt.status).toBe("absent");
      expect(poojaAtt.halfDayType).toBe("first-half");
      expect(poojaAtt.adjustmentReason).toContain("Approved half-day leave");
    });

    test("classifies a legacy full_day record with half-day markers as a half-day", async () => {
      const targetDate = "2026-11-09";
      await Leave.create({
        employeeId: employeeUser2._id,
        applicantRole: "employee",
        leaveType: "full_day",
        isHalfDay: true,
        halfDayType: "second-half",
        startDate: new Date("2026-11-09T00:00:00.000Z"),
        endDate: new Date("2026-11-09T23:59:59.999Z"),
        totalDays: 0.5,
        reason: "Legacy mismatched leave",
        status: "approved",
      });

      const result = await runDailyAttendanceFinalization({
        targetDate,
        executionType: "SCHEDULED",
        dryRun: false,
      });

      expect(result.summary.preservedHalfDayLeaves).toBe(1);
      expect(result.summary.preservedLeaves).toBe(0);
      const attendance = await Attendance.findOne({ userId: employeeUser2._id, date: targetDate });
      expect(attendance.status).toBe("absent");
      expect(attendance.halfDayType).toBe("second-half");
      expect(attendance.adjustmentReason).toContain("Approved half-day leave");
    });

    test("2.6 Pending leave requests are tagged provisional absent without imposing extra penalty", async () => {
      const targetDate = "2026-11-09";

      // Amit has a pending leave request
      await Leave.create({
        employeeId: employeeUser3._id,
        applicantRole: "employee",
        leaveType: "sick",
        startDate: new Date("2026-11-09T00:00:00.000Z"),
        endDate: new Date("2026-11-09T23:59:59.000Z"),
        totalDays: 1,
        reason: "Medical test",
        status: "pending",
      });

      const result = await runDailyAttendanceFinalization({
        targetDate,
        executionType: "SCHEDULED",
        dryRun: false,
      });

      expect(result.summary.pendingLeaves).toBe(1);

      const amitAtt = await Attendance.findOne({ userId: employeeUser3._id, date: targetDate });
      expect(amitAtt.status).toBe("absent");
      expect(amitAtt.adjustmentReason).toContain("Provisional absent (pending leave approval");
    });

    test("2.7 Skips future joiners and deactivated employees", async () => {
      const targetDate = "2026-11-09";

      const result = await runDailyAttendanceFinalization({
        targetDate,
        executionType: "SCHEDULED",
        dryRun: false,
      });

      expect(result.summary.skippedFutureJoiners).toBe(1);
      const futureAtt = await Attendance.findOne({ userId: futureEmployee._id, date: targetDate });
      expect(futureAtt).toBeNull();

      const deactAtt = await Attendance.findOne({ userId: deactivatedEmployee._id, date: targetDate });
      expect(deactAtt).toBeNull();
    });
  });

  // =========================================================================
  // 3. SUNDAY & HOLIDAY MASTER EXCLUSIONS
  // =========================================================================
  describe("3. Sunday & Holiday Master Exclusions", () => {
    test("3.1 Skips finalization on Sunday (Weekly Holiday)", async () => {
      // 2026-11-08 is Sunday
      const sundayDate = "2026-11-08";

      const result = await runDailyAttendanceFinalization({
        targetDate: sundayDate,
        executionType: "SCHEDULED",
        dryRun: false,
      });

      expect(result.skipped).toBe(true);
      expect(result.summary.isSunday).toBe(true);
      expect(result.summary.markedAbsent).toBe(0);

      // Verify no attendance records were created
      const count = await Attendance.countDocuments({ date: sundayDate });
      expect(count).toBe(0);

      // Verify job log indicates SKIPPED
      const log = await AttendanceJobLog.findOne({ date: sundayDate });
      expect(log.status).toBe("SKIPPED");
      expect(log.isSunday).toBe(true);
    });

    test("3.2 Skips finalization on configured holiday in Holiday Master", async () => {
      // 2026-11-21 is 3rd Saturday - Configure as Company Holiday
      const holidayDate = "2026-11-21";

      await Holiday.create({
        holidayName: "Founders Day Holiday",
        holidayDate: new Date("2026-11-21T00:00:00.000Z"),
        isPublicHoliday: true,
      });

      const result = await runDailyAttendanceFinalization({
        targetDate: holidayDate,
        executionType: "SCHEDULED",
        dryRun: false,
      });

      expect(result.skipped).toBe(true);
      expect(result.summary.isHoliday).toBe(true);
      expect(result.summary.markedAbsent).toBe(0);

      const count = await Attendance.countDocuments({ date: holidayDate });
      expect(count).toBe(0);

      const log = await AttendanceJobLog.findOne({ date: holidayDate });
      expect(log.status).toBe("SKIPPED");
      expect(log.isHoliday).toBe(true);
    });
  });

  // =========================================================================
  // 4. IDEMPOTENCY & DUPLICATE PREVENTION
  // =========================================================================
  describe("4. Idempotency & Duplicate Prevention", () => {
    test("4.1 Running finalization multiple times for the same date never duplicates records", async () => {
      const targetDate = "2026-11-09";

      // First run
      const run1 = await runDailyAttendanceFinalization({ targetDate, executionType: "SCHEDULED" });
      expect(run1.summary.markedAbsent).toBe(3);

      const initialCount = await Attendance.countDocuments({ date: targetDate });
      expect(initialCount).toBe(3);

      // Second run (e.g. repeated or retry)
      const run2 = await runDailyAttendanceFinalization({ targetDate, executionType: "SCHEDULED" });
      const secondCount = await Attendance.countDocuments({ date: targetDate });

      // Constraint check: Count must remain exactly 3!
      expect(secondCount).toBe(initialCount);
    });
  });

  // =========================================================================
  // 5. TIMEZONE AWARENESS & CATCH-UP LOGIC
  // =========================================================================
  describe("5. Timezone Awareness & Scheduler Catch-Up", () => {
    test("5.1 Timezone conversion converts any UTC timestamp to Asia/Kolkata date", () => {
      // 10:30 UTC on 2026-11-09 = 16:00 (4:00 PM) IST on 2026-11-09
      const utcDate = new Date("2026-11-09T10:30:00.000Z");
      const istDate = toISTDate(utcDate);

      expect(istDate.getUTCHours() * 60 + istDate.getUTCMinutes()).toBe(16 * 60);
      expect(getISTDateString(utcDate)).toBe("2026-11-09");
    });

    test("5.2 Computes milliseconds until next 16:00 IST correctly", () => {
      // At 10:00 AM IST, ms until 16:00 IST is exactly 6 hours
      const morningIST = new Date("2026-11-09T04:30:00.000Z"); // 04:30 UTC = 10:00 IST
      const ms = getMsUntilNextIST4PM(morningIST);
      const hours = ms / (1000 * 60 * 60);
      expect(hours).toBeCloseTo(6, 1);
    });

    test("5.3 Catch-up execution occurs if server starts after 16:00 IST without today's log", async () => {
      const todayStr = getISTDateString();

      // Ensure no log exists
      await AttendanceJobLog.deleteMany({ date: todayStr });

      // Trigger startAttendanceScheduler
      await startAttendanceScheduler({ forceCatchUp: true });

      // Job log should have been created via catch-up
      const log = await AttendanceJobLog.findOne({
        date: todayStr,
        status: { $in: ["SUCCESS", "SKIPPED"] },
      });

      expect(log).not.toBeNull();
      stopAttendanceScheduler();
    });
  });

  // =========================================================================
  // 6. API ENDPOINTS & RBAC
  // =========================================================================
  describe("6. API Endpoints (Finalize, Preview, Logs)", () => {
    test("6.1 POST /api/attendance/finalize-daily: Allowed for Admin and HR", async () => {
      currentAuthUser = adminUser;
      const res = await request(app)
        .post("/api/attendance/finalize-daily")
        .set("Authorization", `Bearer ${makeToken(adminUser)}`)
        .send({ targetDate: "2026-11-10" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.markedAbsent).toBe(3);
    });

    test("6.2 POST /api/attendance/finalize-daily: FORBIDDEN for normal employee (403)", async () => {
      currentAuthUser = employeeUser1; // Employee role
      const res = await request(app)
        .post("/api/attendance/finalize-daily")
        .set("Authorization", `Bearer ${makeToken(employeeUser1)}`)
        .send({ targetDate: "2026-11-10" });

      expect(res.status).toBe(403);
    });

    test("6.3 GET /api/attendance/finalize-daily/preview: Previews without altering database", async () => {
      currentAuthUser = hrUser;
      const res = await request(app)
        .get("/api/attendance/finalize-daily/preview")
        .set("Authorization", `Bearer ${makeToken(hrUser)}`)
        .query({ date: "2026-11-11" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dryRun).toBe(true);
      expect(res.body.data.markedAbsent).toBe(3);

      // Verify no records created in DB for 2026-11-11
      const count = await Attendance.countDocuments({ date: "2026-11-11" });
      expect(count).toBe(0);
    });

    test("6.4 GET /api/attendance/scheduler/logs: Returns paginated scheduler logs", async () => {
      currentAuthUser = adminUser;
      await AttendanceJobLog.create({
        jobName: "DAILY_ATTENDANCE_FINALIZATION",
        date: "2026-11-09",
        status: "SUCCESS",
        summary: { markedAbsent: 3, checkedIn: 0 },
      });

      const res = await request(app)
        .get("/api/attendance/scheduler/logs")
        .set("Authorization", `Bearer ${makeToken(adminUser)}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 7. PAYROLL & ATTENDANCE INTEGRATION
  // =========================================================================
  describe("7. Payroll Integration with Finalized Attendance", () => {
    test("7.1 Approved half-day leave with completed 4-hour attendance produces no duplicate absence deduction", async () => {
      // Create salary structure for Rahul
      await SalaryStructure.create({
        userId: employeeUser1._id,
        structureType: "SIMPLE_FIXED",
        fixedSalary: 6000,
        grossSalary: 6000,
        basicSalary: 6000,
        effectiveFrom: new Date("2026-01-01"),
        isActive: true,
      });

      // Approved half-day leave on 2026-11-12
      await Leave.create({
        employeeId: employeeUser1._id,
        applicantRole: "employee",
        leaveType: "half_day_1",
        isHalfDay: true,
        startDate: new Date("2026-11-12T00:00:00.000Z"),
        endDate: new Date("2026-11-12T23:59:59.000Z"),
        totalDays: 0.5,
        reason: "Family event",
        status: "approved",
      });

      // Worked 4.5 hours on that day (status: half-day)
      await Attendance.create({
        userId: employeeUser1._id,
        userType: "employee",
        date: "2026-11-12",
        status: "half-day",
        totalWorkTime: 4.5,
      });

      const payroll = await calculateMonthlyPayroll({
        user: employeeUser1,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        isPenaltyApproved: true,
      });

      // Approved leave deduction: 0.5 days (₹100)
      // Attendance half-day worked: 0 unapproved deduction, 0 duplicate deduction!
      expect(payroll.leaveDeductions.approvedLeaveDays).toBe(0.5);
      expect(payroll.leaveDeductions.unapprovedLeaveDays).toBe(0);
      expect(payroll.leaveDeductions.unpaidLeaveDeduction).toBe(100);
      expect(payroll.leaveDeductions.proposedPenaltyAmount).toBe(0);
      expect(payroll.netSalary).toBe(5900);
    });

    test("7.2 Provisional absent due to pending leave incurs 0 penalties in payroll", async () => {
      // Pending leave on 2026-11-13
      await Leave.create({
        employeeId: employeeUser1._id,
        applicantRole: "employee",
        leaveType: "sick",
        startDate: new Date("2026-11-13T00:00:00.000Z"),
        endDate: new Date("2026-11-13T23:59:59.000Z"),
        totalDays: 1,
        reason: "Health checkup",
        status: "pending",
      });

      // Provisional absent created by 4:00 PM scheduler
      await Attendance.create({
        userId: employeeUser1._id,
        userType: "employee",
        date: "2026-11-13",
        status: "absent",
        adjustmentReason: "Provisional absent (pending leave approval; extra penalties protected)",
      });

      const payroll = await calculateMonthlyPayroll({
        user: employeeUser1,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        isPenaltyApproved: true,
      });

      // Proposed penalty amount MUST be 0 because leave is pending approval!
      expect(payroll.leaveDeductions.proposedPenaltyAmount).toBe(0);
      expect(payroll.leaveDeductions.legallyApprovedPenalties).toBe(0);
    });
  });
});
