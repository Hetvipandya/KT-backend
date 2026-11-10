const mongoose = require("mongoose");
jest.setTimeout(60000);
const request = require("supertest");
const express = require("express");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../models/User");
const Company = require("../models/Company");
const Branch = require("../models/Branch");
const SalaryStructure = require("../models/SalaryStructure");
const MonthlySalary = require("../models/MonthlySalary");
const Holiday = require("../models/Holiday");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");

const { calculateMonthlyPayroll } = require("../services/payrollCalculationService");
const salaryStructureRoutes = require("../routes/salaryStructureRoutes");
const monthlySalaryRoutes = require("../routes/monthlySalaryRoutes");
const employeeDeductionRoutes = require("../routes/employeeDeductionRoutes");
const salarySlipRoutes = require("../routes/salarySlipRoutes");
const holidayRoutes = require("../routes/holidayRoutes");
const leaveRoutes = require("../routes/leaveRoutes");

describe("Salary, Leave & Holiday Integration Test Suite", () => {
  let mongoServer;
  let app;
  let companyId;
  let branchId;
  let adminUser;
  let hrUser;
  let simpleFixedEmployee;
  let componentEmployee;
  let currentAuthUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    companyId = new mongoose.Types.ObjectId();
    branchId = new mongoose.Types.ObjectId();

    await Company.create({
      _id: companyId,
      name: "Kevalon Technologies",
      companyName: "Kevalon Technologies",
      address: "Solaris Business Hub, Ahmedabad",
    });

    await Branch.create({
      _id: branchId,
      companyId,
      branchName: "Ahmedabad HQ",
    });

    adminUser = await User.create({
      name: "Admin User",
      email: "admin@kevalon.com",
      phoneNumber: "9876543210",
      password: "password123",
      role: "admin",
      uniqueID: "ADM-001",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    hrUser = await User.create({
      name: "HR Manager",
      email: "hr@kevalon.com",
      phoneNumber: "9876543211",
      password: "password123",
      role: "hr",
      uniqueID: "HR-001",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    simpleFixedEmployee = await User.create({
      name: "Fixed Worker",
      email: "fixed@kevalon.com",
      phoneNumber: "9876543212",
      password: "password123",
      role: "employee",
      uniqueID: "EMP-FIX-001",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
      designation: "Trainee",
      department: "Operations",
    });

    componentEmployee = await User.create({
      name: "Senior Engineer",
      email: "engineer@kevalon.com",
      phoneNumber: "9876543213",
      password: "password123",
      role: "employee",
      uniqueID: "EMP-CMP-001",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
      designation: "Software Engineer",
      department: "Engineering",
    });

    app = express();
    app.use(express.json());

    // Mock authenticated user middleware
    app.use((req, res, next) => {
      req.user = currentAuthUser || adminUser;
      next();
    });

    app.use("/api/salary-structures", salaryStructureRoutes);
    app.use("/api/salaries", monthlySalaryRoutes);
    app.use("/api/deductions", employeeDeductionRoutes);
    app.use("/api/salary-slips", salarySlipRoutes);
    app.use("/api/holidays", holidayRoutes);
    app.use("/api/leave", leaveRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    currentAuthUser = adminUser;
  });

  // =========================================================================
  // 1. DYNAMIC SALARY STRUCTURE & STATUTORY DEDUCTION RULES
  // =========================================================================
  describe("1. Dynamic Salary Structure & Statutory Compliance", () => {
    test("1.1 Creates SIMPLE_FIXED salary structure (₹6,000 fixed salary without statutory deductions)", async () => {
      currentAuthUser = hrUser;

      const res = await request(app)
        .post("/api/salary-structures")
        .send({
          employeeId: simpleFixedEmployee._id,
          structureType: "SIMPLE_FIXED",
          fixedSalary: 6000,
          isPfApplicable: false,
          isEsicApplicable: false,
          isPtApplicable: false,
          isTdsApplicable: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.structureType).toBe("SIMPLE_FIXED");
      expect(res.body.data.fixedSalary).toBe(6000);
      expect(res.body.data.basicSalary).toBe(6000);
      expect(res.body.data.grossSalary).toBe(6000);
      expect(res.body.data.pfDeduction).toBe(0);
      expect(res.body.data.esicDeduction).toBe(0);
      expect(res.body.data.professionalTax).toBe(0);
      expect(res.body.data.tds).toBe(0);
      expect(res.body.data.netSalary).toBe(6000);
    });

    test("1.2 Calculates payroll for ₹6,000 fixed salary: net salary is ₹6,000 with 0 statutory deductions", async () => {
      const payroll = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
      });

      expect(payroll.structureType).toBe("SIMPLE_FIXED");
      expect(payroll.baseEarnings.monthlySalary).toBe(6000);
      expect(payroll.grossSalary).toBe(6000);
      expect(payroll.perDaySalary).toBe(200); // 6000 / 30 = 200
      expect(payroll.statutoryDeductions.pfDeduction).toBe(0);
      expect(payroll.statutoryDeductions.esicDeduction).toBe(0);
      expect(payroll.statutoryDeductions.professionalTax).toBe(0);
      expect(payroll.statutoryDeductions.tds).toBe(0);
      expect(payroll.statutoryDeductions.totalStatutoryDeductions).toBe(0);
      expect(payroll.netSalary).toBe(6000);
    });

    test("1.3 Supports Extra Earnings (Extra Allowance, Incentive, Bonus) on fixed structure", async () => {
      const payroll = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        extraAllowance: 500,
        incentive: 1000,
        bonus: 1500,
      });

      expect(payroll.extraEarnings.extraAllowance).toBe(500);
      expect(payroll.extraEarnings.incentive).toBe(1000);
      expect(payroll.extraEarnings.bonus).toBe(1500);
      expect(payroll.extraEarnings.totalExtraEarnings).toBe(3000);
      expect(payroll.grossSalary).toBe(9000); // 6000 + 3000
      expect(payroll.netSalary).toBe(9000);
    });

    test("1.4 Creates COMPONENT_BASED structure (₹60,000 gross) with statutory deductions", async () => {
      const res = await request(app)
        .post("/api/salary-structures")
        .send({
          employeeId: componentEmployee._id,
          structureType: "COMPONENT_BASED",
          basicSalary: 30000,
          hra: 15000,
          dearnessAllowance: 5000,
          specialAllowance: 10000,
          isPfApplicable: true,
          isEsicApplicable: false, // Statutory wage limit > 21,000
          isPtApplicable: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.structureType).toBe("COMPONENT_BASED");
      expect(res.body.data.basicSalary).toBe(30000);
      expect(res.body.data.grossSalary).toBe(60000);
      // BasicForPf = 35000 -> PF = 12% = 4200
      expect(res.body.data.pfDeduction).toBe(4200);
      // PT: Gross > 12000 => 200
      expect(res.body.data.professionalTax).toBe(200);
      // ESIC: Gross 60,000 > 21,000 statutory limit => 0
      expect(res.body.data.esicDeduction).toBe(0);
    });
  });

  // =========================================================================
  // 2. DYNAMIC SATURDAY HOLIDAY RULES
  // =========================================================================
  describe("2. Dynamic Saturday Holiday Rules", () => {
    test("2.1 By default, 2nd Saturday and 4th Saturday are default holidays", async () => {
      // November 2026:
      // 14 Nov 2026 is 2nd Saturday
      // 28 Nov 2026 is 4th Saturday
      const novWorkingCheck = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "CALENDAR_DAYS",
      });

      // Total calendar days in Nov = 30.
      // Sundays in Nov 2026: 1, 8, 15, 22, 29 = 5 Sundays.
      // Default 2nd and 4th Saturday holidays = 2 (14 Nov, 28 Nov).
      // Configured other holidays: 0.
      // Standard working days = 30 - 5 - 2 = 23 working days.
      expect(novWorkingCheck.days.sundaysCount).toBe(5);
      expect(novWorkingCheck.days.saturdayHolidaysCount).toBe(2);
      expect(novWorkingCheck.days.configuredHolidaysCount).toBe(0);
      expect(novWorkingCheck.days.workingDays).toBe(23);
      expect(novWorkingCheck.calculationDivisor).toBe(23);
    });

    test("2.2 Saturday is configured in Holiday Master (e.g. 3rd Saturday configured)", async () => {
      // 21 Nov 2026 is 3rd Saturday
      await Holiday.create({
        holidayName: "Special Saturday Holiday",
        holidayDate: new Date("2026-11-21T00:00:00.000Z"),
        isPublicHoliday: true,
      });

      const novWithSatHoliday = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "CALENDAR_DAYS",
      });

      expect(novWithSatHoliday.days.sundaysCount).toBe(5);
      expect(novWithSatHoliday.days.saturdayHolidaysCount).toBe(1);
      expect(novWithSatHoliday.days.configuredHolidaysCount).toBe(0);
      // Standard working days = 30 - 5 Sundays - 1 Configured Sat Holiday = 24
      expect(novWithSatHoliday.days.workingDays).toBe(24);
      expect(novWithSatHoliday.calculationDivisor).toBe(24);

      // Clean up holiday
      await Holiday.deleteMany({});
    });

    test("2.3 Matches Specification Example: 31 Calendar Days, 5 Sundays, 2 Sat Holidays => 24 Working Days, Per Day = ₹500", async () => {
      // May 2026: 31 Calendar Days, 5 Sundays (3, 10, 17, 24, 31), 2 Saturday Holidays (9, 23 May)
      // 31 - 5 - 2 = 24 Working Days
      const exampleUser = await User.create({
        name: "Example Employee",
        email: "example@kevalon.com",
        phoneNumber: "9876543298",
        password: "password123",
        role: "employee",
        uniqueID: "EMP-EX-001",
        companyId,
        branchId,
        isApproved: true,
        status: "Active",
      });

      await SalaryStructure.create({
        userId: exampleUser._id,
        structureType: "SIMPLE_FIXED",
        fixedSalary: 12000,
        isPfApplicable: false,
        isEsicApplicable: false,
        isPtApplicable: false,
        isTdsApplicable: false,
        effectiveFrom: new Date("2026-01-01"),
      });

      // 1 Approved Full Day = 1 day (₹500)
      // 1 Approved Half Day = 0.5 day (₹250)
      // 1 Unauthorized Full Day = 1 day (₹500)
      // 1 Unauthorized Half Day = 0.5 day (₹250)
      // Actual Absence = 1 + 0.5 + 1 + 0.5 = 3 days
      // Payable Days = 24 - 3 = 21
      // LOP = 3 * ₹500 = ₹1,500
      // Earned Base Salary = ₹12,000 - ₹1,500 = ₹10,500
      // Proposed Penalty = 2 incidents * 0.5 * ₹500 = ₹500

      // Case A: Before Penalty Authorization
      const beforeAuth = await calculateMonthlyPayroll({
        user: exampleUser,
        month: 5,
        year: 2026,
        calculationMode: "CALENDAR_DAYS",
        approvedLeaveDays: 1.5,
        unauthorizedFullDays: 1,
        unauthorizedHalfDays: 1,
        isPenaltyApproved: false,
      });

      expect(beforeAuth.calendarDays).toBe(31);
      expect(beforeAuth.days.sundaysCount).toBe(5);
      expect(beforeAuth.days.saturdayHolidaysCount).toBe(2);
      expect(beforeAuth.days.configuredHolidaysCount).toBe(0);
      expect(beforeAuth.workingDays).toBe(24);
      expect(beforeAuth.calculationDivisor).toBe(24);
      expect(beforeAuth.perDaySalary).toBe(500);

      expect(beforeAuth.approvedLeaveDays).toBe(1.5);
      expect(beforeAuth.unauthorizedFullDayCount).toBe(1);
      expect(beforeAuth.unauthorizedHalfDayCount).toBe(1);
      expect(beforeAuth.penaltyEligibleIncidentCount).toBe(2);
      expect(beforeAuth.actualAbsenceDays).toBe(3);
      expect(beforeAuth.payableDays).toBe(21);

      expect(beforeAuth.monthlySalary).toBe(12000);
      expect(beforeAuth.lop).toBe(1500);
      expect(beforeAuth.earnedBaseSalary).toBe(10500);
      expect(beforeAuth.gross).toBe(12000);
      expect(beforeAuth.proposedPenalty).toBe(500);
      expect(beforeAuth.appliedPenalty).toBe(0);
      expect(beforeAuth.totalAppliedDeductions).toBe(1500);
      expect(beforeAuth.netSalary).toBe(10500);

      // Case B: After Penalty Authorization
      const afterAuth = await calculateMonthlyPayroll({
        user: exampleUser,
        month: 5,
        year: 2026,
        calculationMode: "CALENDAR_DAYS",
        approvedLeaveDays: 1.5,
        unauthorizedFullDays: 1,
        unauthorizedHalfDays: 1,
        isPenaltyApproved: true,
      });

      expect(afterAuth.payableDays).toBe(21); // Payable days remains 21!
      expect(afterAuth.appliedPenalty).toBe(500);
      expect(afterAuth.totalAppliedDeductions).toBe(2000);
      expect(afterAuth.netSalary).toBe(10000);
    });
  });

  // =========================================================================
  // 3. LEAVE DEDUCTION RULES (UNPAID LEAVES, PENALTIES, DUPLICATE PREVENTION)
  // =========================================================================
  describe("3. Leave Deduction Rules & Penalties", () => {
    test("3.1 Approved Full-Day Leave = 1 Day LOP, 0 penalty (₹200 on ₹6,000 basis)", async () => {
      // Create approved full-day leave on 2026-11-04 (Wednesday)
      await Leave.create({
        employeeId: simpleFixedEmployee._id,
        applicantRole: "employee",
        startDate: new Date("2026-11-04T00:00:00.000Z"),
        endDate: new Date("2026-11-04T00:00:00.000Z"),
        leaveType: "full_day",
        reason: "Personal work",
        totalDays: 1,
        status: "approved",
      });

      const payroll = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
      });

      // Monthly = 6000, 30 days -> Per day = 200
      expect(payroll.perDaySalary).toBe(200);
      expect(payroll.leaveDeductions.approvedLeaveDays).toBe(1);
      expect(payroll.leaveDeductions.unpaidLeaveDays).toBe(1);
      expect(payroll.leaveDeductions.unpaidLeaveDeduction).toBe(200);
      expect(payroll.leaveDeductions.proposedPenaltyAmount).toBe(0);
      expect(payroll.leaveDeductions.legallyApprovedPenalties).toBe(0);
      // Net = 6000 - 200 = 5800
      expect(payroll.netSalary).toBe(5800);

      await Leave.deleteMany({});
    });

    test("3.2 Approved Half-Day Leave = 0.5 Day LOP, 0 penalty (₹100 on ₹6,000 basis)", async () => {
      await Leave.create({
        employeeId: simpleFixedEmployee._id,
        applicantRole: "employee",
        startDate: new Date("2026-11-04T00:00:00.000Z"),
        endDate: new Date("2026-11-04T00:00:00.000Z"),
        leaveType: "half_day_1",
        reason: "Personal work",
        isHalfDay: true,
        totalDays: 0.5,
        status: "approved",
      });

      const payroll = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
      });

      expect(payroll.leaveDeductions.approvedLeaveDays).toBe(0.5);
      expect(payroll.leaveDeductions.unpaidLeaveDays).toBe(0.5);
      expect(payroll.leaveDeductions.unpaidLeaveDeduction).toBe(100);
      expect(payroll.leaveDeductions.proposedPenaltyAmount).toBe(0);
      expect(payroll.leaveDeductions.legallyApprovedPenalties).toBe(0);
      expect(payroll.netSalary).toBe(5900);

      await Leave.deleteMany({});
    });

    test("legacy second-half markers are counted as 0.5 leave day in payroll", async () => {
      await Leave.create({
        employeeId: simpleFixedEmployee._id,
        applicantRole: "employee",
        startDate: new Date("2026-11-04T00:00:00.000Z"),
        endDate: new Date("2026-11-04T00:00:00.000Z"),
        leaveType: "half_day_2",
        reason: "Legacy second-half leave",
        isHalfDay: false,
        halfDayType: "second-half",
        totalDays: 0.5,
        status: "approved",
      });

      const payroll = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
      });

      expect(payroll.leaveDeductions.approvedLeaveDays).toBe(0.5);
      expect(payroll.leaveDeductions.unpaidLeaveDays).toBe(0.5);

      await Leave.deleteMany({});
    });

    test("3.3 Unapproved Full-Day Leave = 1 Day LOP + proposed 0.5 Day penalty (₹200 LOP + proposed ₹100 penalty)", async () => {
      // Unapproved absence recorded in Attendance on 2026-11-04
      await Attendance.create({
        userId: simpleFixedEmployee._id,
        userType: "employee",
        date: "2026-11-04",
        status: "absent",
      });

      // Without penalty approval: proposed penalty tracked, but not deducted
      const withoutAuth = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        isPenaltyApproved: false,
      });

      expect(withoutAuth.leaveDeductions.unapprovedLeaveDays).toBe(1);
      expect(withoutAuth.leaveDeductions.unpaidLeaveDeduction).toBe(200);
      expect(withoutAuth.leaveDeductions.proposedPenaltyAmount).toBe(100);
      expect(withoutAuth.leaveDeductions.legallyApprovedPenalties).toBe(0);
      expect(withoutAuth.netSalary).toBe(5800); // 6000 - 200

      // Do not classify extra 0.5 day as actual absence
      expect(withoutAuth.days.presentDays).toBe(29); // 30 - 1

      // With legal & authorized penalty approval:
      const withAuth = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        isPenaltyApproved: true,
      });

      expect(withAuth.leaveDeductions.proposedPenaltyAmount).toBe(100);
      expect(withAuth.leaveDeductions.legallyApprovedPenalties).toBe(100);
      // Net = 6000 - 200 LOP - 100 Penalty = 5700
      expect(withAuth.netSalary).toBe(5700);
      // Present days still 29 (extra penalty not classified as absence)
      expect(withAuth.days.presentDays).toBe(29);

      await Attendance.deleteMany({});
    });

    test("3.4 Unapproved Half-Day Leave = 0.5 Day LOP + proposed 0.5 Day penalty (₹100 LOP + proposed ₹100 penalty)", async () => {
      await Attendance.create({
        userId: simpleFixedEmployee._id,
        userType: "employee",
        date: "2026-11-05",
        status: "half-day",
      });

      const withAuth = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        isPenaltyApproved: true,
      });

      expect(withAuth.leaveDeductions.unapprovedLeaveDays).toBe(0.5);
      expect(withAuth.leaveDeductions.unpaidLeaveDeduction).toBe(100);
      expect(withAuth.leaveDeductions.proposedPenaltyAmount).toBe(100);
      expect(withAuth.leaveDeductions.legallyApprovedPenalties).toBe(100);
      // Net = 6000 - 100 LOP - 100 Penalty = 5800
      expect(withAuth.netSalary).toBe(5800);

      await Attendance.deleteMany({});
    });

    test("3.5 Avoid duplicate deductions between Attendance and Leave records", async () => {
      // Same date: Approved Leave AND Attendance "absent" mark
      await Leave.create({
        employeeId: simpleFixedEmployee._id,
        applicantRole: "employee",
        startDate: new Date("2026-11-06T00:00:00.000Z"),
        endDate: new Date("2026-11-06T00:00:00.000Z"),
        leaveType: "sick",
        reason: "Fever",
        totalDays: 1,
        status: "approved",
      });

      await Attendance.create({
        userId: simpleFixedEmployee._id,
        userType: "employee",
        date: "2026-11-06",
        status: "absent",
      });

      const payroll = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        isPenaltyApproved: true,
      });

      // Should count only once (1 Day approved leave, ₹200 deduction, 0 unapproved, 0 penalty)
      expect(payroll.leaveDeductions.approvedLeaveDays).toBe(1);
      expect(payroll.leaveDeductions.unapprovedLeaveDays).toBe(0);
      expect(payroll.leaveDeductions.unpaidLeaveDeduction).toBe(200);
      expect(payroll.leaveDeductions.proposedPenaltyAmount).toBe(0);
      expect(payroll.netSalary).toBe(5800);

      await Leave.deleteMany({});
      await Attendance.deleteMany({});
    });

    test("3.6 Pending leave approvals must not automatically trigger penalties", async () => {
      // Pending leave on 2026-11-09 + attendance absent
      await Leave.create({
        employeeId: simpleFixedEmployee._id,
        applicantRole: "employee",
        startDate: new Date("2026-11-09T00:00:00.000Z"),
        endDate: new Date("2026-11-09T00:00:00.000Z"),
        leaveType: "unpaid",
        reason: "Family emergency",
        totalDays: 1,
        status: "pending",
      });

      await Attendance.create({
        userId: simpleFixedEmployee._id,
        userType: "employee",
        date: "2026-11-09",
        status: "absent",
      });

      const payroll = await calculateMonthlyPayroll({
        user: simpleFixedEmployee,
        month: 11,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        isPenaltyApproved: true, // Even if penalty flag is true, pending leaves must NOT trigger penalty!
      });

      expect(payroll.leaveDeductions.unapprovedLeaveDays).toBe(1);
      expect(payroll.leaveDeductions.unpaidLeaveDeduction).toBe(200);
      expect(payroll.leaveDeductions.proposedPenaltyAmount).toBe(0);
      expect(payroll.leaveDeductions.legallyApprovedPenalties).toBe(0);
      expect(payroll.netSalary).toBe(5800);

      await Leave.deleteMany({});
      await Attendance.deleteMany({});
    });
  });

  // =========================================================================
  // 4. PAYROLL INTEGRATION & HISTORICAL PRESERVATION (LOCKING)
  // =========================================================================
  describe("4. Centralized Payroll Integration & Historical Locking", () => {
    test("4.1 Generates monthly salary record with all new breakdown fields", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .post("/api/salaries/generate")
        .send({
          companyId,
          branchId,
          month: 11,
          year: 2026,
          employeeId: simpleFixedEmployee._id,
          calculationMode: "THIRTY_DAYS",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const record = res.body.data[0];
      expect(record.structureType).toBe("SIMPLE_FIXED");
      expect(record.monthlySalary).toBe(6000);
      expect(record.grossSalary).toBe(6000);
      expect(record.netSalary).toBe(6000);
      expect(record.status).toBe("Generated");
    });

    test("4.2 Approves monthly salary and locks it", async () => {
      const generated = await MonthlySalary.findOne({
        employeeId: simpleFixedEmployee._id,
        month: 11,
        year: 2026,
      });

      const res = await request(app)
        .post(`/api/salaries/${generated._id}/approve`)
        .send({
          remarks: "Approved for November 2026",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("Approved");
    });

    test("4.3 PREVENTS regeneration of Approved salary and preserves historical record", async () => {
      // Attempt to re-generate for same employee, month, and year
      const res = await request(app)
        .post("/api/salaries/generate")
        .send({
          companyId,
          branchId,
          month: 11,
          year: 2026,
          employeeId: simpleFixedEmployee._id,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already Approved/i);

      // Verify the record in DB was NOT changed or overwritten
      const salaryDoc = await MonthlySalary.findOne({
        employeeId: simpleFixedEmployee._id,
        month: 11,
        year: 2026,
      });
      expect(salaryDoc.status).toBe("Approved");
    });

    test("4.4 PREVENTS direct modification of Approved salary record", async () => {
      const salaryDoc = await MonthlySalary.findOne({
        employeeId: simpleFixedEmployee._id,
        month: 11,
        year: 2026,
      });

      const res = await request(app)
        .put(`/api/salaries/${salaryDoc._id}`)
        .send({
          basicSalary: 8000,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already Approved/i);
    });

    test("4.5 Payslip HTML and PDF render unpaid leave deduction and approved penalties separately", async () => {
      // Create a salary record with both unpaid leave deduction and penalty
      const testSalary = await MonthlySalary.create({
        employeeId: componentEmployee._id,
        userId: componentEmployee._id,
        month: 12,
        year: 2026,
        salaryMonth: "December 2026",
        structureType: "COMPONENT_BASED",
        monthlySalary: 60000,
        basicSalary: 30000,
        hra: 15000,
        grossSalary: 60000,
        totalDays: 30,
        workingDays: 26,
        presentDays: 24,
        daysPayable: 24,
        unpaidLeaveDays: 2,
        unpaidLeaveDeduction: 4000,
        legallyApprovedPenalties: 1000,
        pfDeduction: 0,
        esicDeduction: 0,
        professionalTax: 0,
        totalDeduction: 5000,
        netSalary: 55000,
        status: "Approved",
      });

      // 1. HTML Payslip
      const htmlRes = await request(app)
        .get(`/api/salary-slips/${testSalary._id}`)
        .send();

      expect(htmlRes.status).toBe(200);
      expect(htmlRes.text).toContain("Unpaid Leave Deduction (2 Days)");
      expect(htmlRes.text).toContain("Legally Approved Penalty");

      // 2. PDF Payslip
      const pdfRes = await request(app)
        .get(`/api/salary-slips/pdf/${testSalary._id}`)
        .send();

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers["content-type"]).toBe("application/pdf");
    });
  });

  // =========================================================================
  // 5. UNIFIED LEAVE DEDUCTION & PENALTY CALCULATION (₹500/DAY BASIS)
  // =========================================================================
  describe("5. Unified Leave Deduction & Penalty (₹500/day basis) in Preview, Generate & Update", () => {
    let emp500;

    beforeAll(async () => {
      emp500 = await User.create({
        name: "Test 500 Worker",
        email: "worker500@kevalon.com",
        phoneNumber: "9876543299",
        password: "password123",
        role: "employee",
        uniqueID: "EMP-500-001",
        companyId,
        branchId,
        isApproved: true,
        status: "Active",
      });

      await SalaryStructure.create({
        userId: emp500._id,
        structureType: "SIMPLE_FIXED",
        fixedSalary: 15000, // 15000 / 30 = ₹500/day
        calculationMode: "THIRTY_DAYS",
        isPfApplicable: false,
        isEsicApplicable: false,
        isPtApplicable: false,
        isTdsApplicable: false,
        effectiveFrom: new Date("2026-01-01"),
      });
    });

    afterEach(async () => {
      await Attendance.deleteMany({ userId: emp500._id });
      await Leave.deleteMany({ employeeId: emp500._id });
      await MonthlySalary.deleteMany({ employeeId: emp500._id });
    });

    test("5.1 Approved Full Day: Actual Cut ₹500, Penalty ₹0, Total Cut ₹500", async () => {
      const payroll = await calculateMonthlyPayroll({
        user: emp500,
        month: 10,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        approvedLeaveDays: 1,
        unauthorizedFullDays: 0,
        unauthorizedHalfDays: 0,
        isPenaltyApproved: true,
      });

      expect(payroll.perDaySalary).toBe(500);
      expect(payroll.approvedLeaveDays).toBe(1);
      expect(payroll.unauthorizedFullDayCount).toBe(0);
      expect(payroll.unauthorizedHalfDayCount).toBe(0);
      expect(payroll.actualAbsenceDays).toBe(1);
      expect(payroll.leaveDeduction).toBe(500);
      expect(payroll.proposedPenalty).toBe(0);
      expect(payroll.appliedPenalty).toBe(0);
      expect(payroll.totalDeduction).toBe(500);
      expect(payroll.netSalary).toBe(14500);
    });

    test("5.2 Approved Half Day: Actual Cut ₹250, Penalty ₹0, Total Cut ₹250", async () => {
      const payroll = await calculateMonthlyPayroll({
        user: emp500,
        month: 10,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        approvedLeaveDays: 0.5,
        unauthorizedFullDays: 0,
        unauthorizedHalfDays: 0,
        isPenaltyApproved: true,
      });

      expect(payroll.perDaySalary).toBe(500);
      expect(payroll.approvedLeaveDays).toBe(0.5);
      expect(payroll.unauthorizedFullDayCount).toBe(0);
      expect(payroll.unauthorizedHalfDayCount).toBe(0);
      expect(payroll.actualAbsenceDays).toBe(0.5);
      expect(payroll.leaveDeduction).toBe(250);
      expect(payroll.proposedPenalty).toBe(0);
      expect(payroll.appliedPenalty).toBe(0);
      expect(payroll.totalDeduction).toBe(250);
      expect(payroll.netSalary).toBe(14750);
    });

    test("5.3 Unauthorized Full Day: Actual Cut ₹500, Penalty ₹250, Total Cut ₹750", async () => {
      const payroll = await calculateMonthlyPayroll({
        user: emp500,
        month: 10,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        approvedLeaveDays: 0,
        unauthorizedFullDays: 1,
        unauthorizedHalfDays: 0,
        isPenaltyApproved: true,
      });

      expect(payroll.perDaySalary).toBe(500);
      expect(payroll.approvedLeaveDays).toBe(0);
      expect(payroll.unauthorizedFullDayCount).toBe(1);
      expect(payroll.unauthorizedHalfDayCount).toBe(0);
      expect(payroll.actualAbsenceDays).toBe(1);
      expect(payroll.leaveDeduction).toBe(500);
      expect(payroll.proposedPenalty).toBe(250);
      expect(payroll.appliedPenalty).toBe(250);
      expect(payroll.totalDeduction).toBe(750);
      expect(payroll.netSalary).toBe(14250);
    });

    test("5.4 Unauthorized Half Day: Actual Cut ₹250, Penalty ₹250, Total Cut ₹500 (NOT ₹375)", async () => {
      const payroll = await calculateMonthlyPayroll({
        user: emp500,
        month: 10,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        approvedLeaveDays: 0,
        unauthorizedFullDays: 0,
        unauthorizedHalfDays: 1,
        isPenaltyApproved: true,
      });

      expect(payroll.perDaySalary).toBe(500);
      expect(payroll.approvedLeaveDays).toBe(0);
      expect(payroll.unauthorizedFullDayCount).toBe(0);
      expect(payroll.unauthorizedHalfDayCount).toBe(1);
      expect(payroll.actualAbsenceDays).toBe(0.5);
      expect(payroll.leaveDeduction).toBe(250);
      expect(payroll.proposedPenalty).toBe(250);
      expect(payroll.appliedPenalty).toBe(250);
      expect(payroll.totalDeduction).toBe(500);
      expect(payroll.netSalary).toBe(14500);
    });

    test("5.5 Two Unauthorized Half Days: Actual Cut ₹500, Penalty ₹500, Total Cut ₹1000", async () => {
      const payroll = await calculateMonthlyPayroll({
        user: emp500,
        month: 10,
        year: 2026,
        calculationMode: "THIRTY_DAYS",
        approvedLeaveDays: 0,
        unauthorizedFullDays: 0,
        unauthorizedHalfDays: 2,
        isPenaltyApproved: true,
      });

      expect(payroll.perDaySalary).toBe(500);
      expect(payroll.approvedLeaveDays).toBe(0);
      expect(payroll.unauthorizedFullDayCount).toBe(0);
      expect(payroll.unauthorizedHalfDayCount).toBe(2);
      expect(payroll.actualAbsenceDays).toBe(1);
      expect(payroll.leaveDeduction).toBe(500);
      expect(payroll.proposedPenalty).toBe(500);
      expect(payroll.appliedPenalty).toBe(500);
      expect(payroll.totalDeduction).toBe(1000);
      expect(payroll.netSalary).toBe(14000);
    });

    test("5.6 Preview, Generate and Update endpoints return all 10 unified fields", async () => {
      // 1. Preview
      const previewRes = await request(app)
        .post("/api/deductions/preview")
        .send({
          employeeId: emp500._id,
          month: 10,
          year: 2026,
          calculationMode: "THIRTY_DAYS",
          unauthorizedHalfDays: 1,
          isPenaltyApproved: true,
        });

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.success).toBe(true);
      const previewData = previewRes.body.data;
      expect(previewData.perDaySalary).toBe(500);
      expect(previewData.approvedLeaveDays).toBe(0);
      expect(previewData.unauthorizedFullDayCount).toBe(0);
      expect(previewData.unauthorizedHalfDayCount).toBe(1);
      expect(previewData.actualAbsenceDays).toBe(0.5);
      expect(previewData.leaveDeduction).toBe(250);
      expect(previewData.proposedPenalty).toBe(250);
      expect(previewData.appliedPenalty).toBe(250);
      expect(previewData.totalDeduction).toBe(500);
      expect(previewData.netSalary).toBe(14500);

      // 2. Generate
      const genRes = await request(app)
        .post("/api/salaries/generate")
        .send({
          companyId,
          branchId,
          month: 10,
          year: 2026,
          employeeId: emp500._id,
          calculationMode: "THIRTY_DAYS",
          unauthorizedHalfDays: 1,
          isPenaltyApproved: true,
        });

      expect(genRes.status).toBe(201);
      expect(genRes.body.success).toBe(true);
      const genData = genRes.body.data[0];
      expect(genData.perDaySalary).toBe(500);
      expect(genData.approvedLeaveDays).toBe(0);
      expect(genData.unauthorizedFullDayCount).toBe(0);
      expect(genData.unauthorizedHalfDayCount).toBe(1);
      expect(genData.actualAbsenceDays).toBe(0.5);
      expect(genData.leaveDeduction).toBe(250);
      expect(genData.proposedPenalty).toBe(250);
      expect(genData.appliedPenalty).toBe(250);
      expect(genData.totalDeduction).toBe(500);
      expect(genData.netSalary).toBe(14500);

      // 3. Update
      const updateRes = await request(app)
        .put(`/api/salaries/${genData._id}`)
        .send({
          unauthorizedHalfDays: 0,
          unauthorizedFullDays: 1,
          isPenaltyApproved: true,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      const updateData = updateRes.body.data;
      expect(updateData.perDaySalary).toBe(500);
      expect(updateData.unauthorizedFullDayCount).toBe(1);
      expect(updateData.unauthorizedHalfDayCount).toBe(0);
      expect(updateData.actualAbsenceDays).toBe(1);
      expect(updateData.leaveDeduction).toBe(500);
      expect(updateData.proposedPenalty).toBe(250);
      expect(updateData.appliedPenalty).toBe(250);
      expect(updateData.totalDeduction).toBe(750);
      expect(updateData.netSalary).toBe(14250);
    });
  });
});
