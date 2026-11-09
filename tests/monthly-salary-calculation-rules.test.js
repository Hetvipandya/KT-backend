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
const monthlySalaryRoutes = require("../routes/monthlySalaryRoutes");
const employeeDeductionRoutes = require("../routes/employeeDeductionRoutes");

describe("Monthly Salary Calculation Rules & Contract Verification", () => {
  let mongoServer;
  let app;
  let companyId;
  let branchId;
  let testUser;
  let authAdmin;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    companyId = new mongoose.Types.ObjectId();
    branchId = new mongoose.Types.ObjectId();

    await Company.create({
      _id: companyId,
      name: "Kevalon Technologies",
      companyName: "Kevalon Technologies",
    });

    await Branch.create({
      _id: branchId,
      companyId,
      branchName: "Main Branch",
    });

    authAdmin = await User.create({
      name: "HR Admin",
      email: "hradmin@kevalon.com",
      phoneNumber: "9876543201",
      password: "password123",
      role: "admin",
      companyId,
      branchId,
      status: "Active",
    });

    testUser = await User.create({
      name: "Bhavik Patel",
      email: "bhavik@kevalon.com",
      phoneNumber: "9876543202",
      password: "password123",
      role: "employee",
      uniqueID: "EMP-BHAVIK",
      companyId,
      branchId,
      status: "Active",
    });

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = authAdmin;
      next();
    });

    app.use("/api/salaries", monthlySalaryRoutes);
    app.use("/api/deductions", employeeDeductionRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Holiday.deleteMany({});
    await Leave.deleteMany({});
    await Attendance.deleteMany({});
    await MonthlySalary.deleteMany({});
    await SalaryStructure.deleteMany({});
  });

  // =========================================================================
  // 1. SPECIFICATION EXAMPLE VERIFICATION
  // =========================================================================
  describe("1. Exact Specification Example Verification", () => {
    test("Verifies all math from specification example with ₹12,000 monthly salary", async () => {
      // Structure: ₹12,000 fixed
      await SalaryStructure.create({
        userId: testUser._id,
        structureType: "SIMPLE_FIXED",
        fixedSalary: 12000,
        isPfApplicable: false,
        isEsicApplicable: false,
        isPtApplicable: false,
        isTdsApplicable: false,
      });

      // May 2026:
      // Calendar Days = 31
      // Sundays (3, 10, 17, 24, 31) = 5
      // 2nd Sat (9 May) & 4th Sat (23 May) = 2
      // Other holidays = 0
      // Working Days = 31 - 5 - 2 = 24
      // Per Day Salary = 12000 / 24 = ₹500

      // Case A: Before Penalty Authorization
      const resultBeforeAuth = await calculateMonthlyPayroll({
        user: testUser,
        month: 5,
        year: 2026,
        calculationMode: "CALENDAR_DAYS",
        approvedLeaveDays: 1.5, // 1 full day + 1 half day
        unauthorizedFullDays: 1, // 1 unauthorized full day
        unauthorizedHalfDays: 1, // 1 unauthorized half day
        isPenaltyApproved: false,
      });

      expect(resultBeforeAuth.calendarDays).toBe(31);
      expect(resultBeforeAuth.sundays).toBe(5);
      expect(resultBeforeAuth.saturdayHolidays).toBe(2);
      expect(resultBeforeAuth.configuredHolidays).toBe(0);
      expect(resultBeforeAuth.workingDays).toBe(24);
      expect(resultBeforeAuth.calculationDivisor).toBe(24);
      expect(resultBeforeAuth.perDaySalary).toBe(500);

      expect(resultBeforeAuth.approvedLeaveDays).toBe(1.5);
      expect(resultBeforeAuth.unauthorizedFullDayCount).toBe(1);
      expect(resultBeforeAuth.unauthorizedHalfDayCount).toBe(1);
      expect(resultBeforeAuth.penaltyEligibleIncidentCount).toBe(2);
      expect(resultBeforeAuth.actualAbsenceDays).toBe(3);
      expect(resultBeforeAuth.payableDays).toBe(21);

      expect(resultBeforeAuth.monthlySalary).toBe(12000);
      expect(resultBeforeAuth.lop).toBe(1500);
      expect(resultBeforeAuth.earnedBaseSalary).toBe(10500);
      expect(resultBeforeAuth.gross).toBe(12000);
      expect(resultBeforeAuth.proposedPenalty).toBe(500);
      expect(resultBeforeAuth.appliedPenalty).toBe(0);
      expect(resultBeforeAuth.totalAppliedDeductions).toBe(1500);
      expect(resultBeforeAuth.netSalary).toBe(10500);

      // Case B: After Penalty Authorization
      const resultAfterAuth = await calculateMonthlyPayroll({
        user: testUser,
        month: 5,
        year: 2026,
        calculationMode: "CALENDAR_DAYS",
        approvedLeaveDays: 1.5,
        unauthorizedFullDays: 1,
        unauthorizedHalfDays: 1,
        isPenaltyApproved: true,
      });

      expect(resultAfterAuth.payableDays).toBe(21); // Payable days remains 21!
      expect(resultAfterAuth.appliedPenalty).toBe(500);
      expect(resultAfterAuth.totalAppliedDeductions).toBe(2000);
      expect(resultAfterAuth.netSalary).toBe(10000);
    });
  });

  // =========================================================================
  // 2. WORKING DAYS & HOLIDAY RULES
  // =========================================================================
  describe("2. Working Days, Saturday Holidays & Overlaps", () => {
    test("Full attendance gives 100% full monthly salary", async () => {
      await SalaryStructure.create({
        userId: testUser._id,
        structureType: "SIMPLE_FIXED",
        fixedSalary: 12000,
        isPfApplicable: false,
        isEsicApplicable: false,
        isPtApplicable: false,
        isTdsApplicable: false,
      });

      const res = await calculateMonthlyPayroll({
        user: testUser,
        month: 5,
        year: 2026,
        approvedLeaveDays: 0,
        unauthorizedFullDays: 0,
        unauthorizedHalfDays: 0,
      });

      expect(res.actualAbsenceDays).toBe(0);
      expect(res.payableDays).toBe(24);
      expect(res.lop).toBe(0);
      expect(res.earnedBaseSalary).toBe(12000);
      expect(res.netSalary).toBe(12000);
    });

    test("Sunday and Holiday overlap is deducted only once (never double counted)", async () => {
      // Add holiday on Sunday 3 May 2026
      await Holiday.create({
        holidayName: "Sunday Festival",
        holidayDate: new Date("2026-05-03T00:00:00.000Z"),
        isPublicHoliday: true,
      });

      const res = await calculateMonthlyPayroll({
        user: testUser,
        month: 5,
        year: 2026,
      });

      // 31 days - 5 Sundays - 2 Saturday Holidays = 24 (since Sunday holiday is deduplicated!)
      expect(res.days.sundaysCount).toBe(5);
      expect(res.days.saturdayHolidaysCount).toBe(2);
      expect(res.workingDays).toBe(24);
    });

    test("Configured custom Saturday holiday in Holiday Master overrides default Saturday holidays", async () => {
      // Configure 1st Saturday (2 May 2026) and 3rd Saturday (16 May 2026) as Saturday holidays
      await Holiday.create({
        holidayName: "Configured 1st Saturday Off",
        holidayDate: new Date("2026-05-02T00:00:00.000Z"),
        isPublicHoliday: true,
      });
      await Holiday.create({
        holidayName: "Configured 3rd Saturday Off",
        holidayDate: new Date("2026-05-16T00:00:00.000Z"),
        isPublicHoliday: true,
      });

      const res = await calculateMonthlyPayroll({
        user: testUser,
        month: 5,
        year: 2026,
      });

      // 5 Sundays + 2 Configured Saturdays = 7 non-working days
      expect(res.days.sundaysCount).toBe(5);
      expect(res.days.saturdayHolidaysCount).toBe(2);
      expect(res.workingDays).toBe(24);
    });

    test("Weekday festival holidays from Holiday Master are also excluded", async () => {
      // 1 May 2026 is Friday (Maharashtra / Labour Day)
      await Holiday.create({
        holidayName: "Labour Day",
        holidayDate: new Date("2026-05-01T00:00:00.000Z"),
        isPublicHoliday: true,
      });

      const res = await calculateMonthlyPayroll({
        user: testUser,
        month: 5,
        year: 2026,
      });

      // 31 - 5 Sundays - 2 Sat Holidays - 1 Friday Holiday = 23 working days
      expect(res.days.sundaysCount).toBe(5);
      expect(res.days.saturdayHolidaysCount).toBe(2);
      expect(res.days.configuredHolidaysCount).toBe(1);
      expect(res.workingDays).toBe(23);
      expect(res.calculationDivisor).toBe(23);
    });
  });

  // =========================================================================
  // 3. UNIFIED CALCULATION IN GENERATE, PREVIEW & UPDATE
  // =========================================================================
  describe("3. Unified Calculation across Generate, Preview and Update", () => {
    beforeEach(async () => {
      await SalaryStructure.create({
        userId: testUser._id,
        structureType: "SIMPLE_FIXED",
        fixedSalary: 12000,
        isPfApplicable: false,
        isEsicApplicable: false,
        isPtApplicable: false,
        isTdsApplicable: false,
      });
    });

    test("Preview, Generate and Update produce identical calculation contract", async () => {
      // 1. Preview
      const previewRes = await request(app)
        .post("/api/salaries/preview")
        .send({
          employeeId: testUser._id,
          month: 5,
          year: 2026,
          approvedLeaveDays: 1.5,
          unauthorizedFullDays: 1,
          unauthorizedHalfDays: 1,
          isPenaltyApproved: true,
        });

      expect(previewRes.status).toBe(200);
      const pData = previewRes.body.data;
      expect(pData.calendarDays).toBe(31);
      expect(pData.sundays).toBe(5);
      expect(pData.workingDays).toBe(24);
      expect(pData.calculationDivisor).toBe(24);
      expect(pData.perDaySalary).toBe(500);
      expect(pData.approvedLeaveDays).toBe(1.5);
      expect(pData.unauthorizedFullDayCount).toBe(1);
      expect(pData.unauthorizedHalfDayCount).toBe(1);
      expect(pData.penaltyEligibleIncidentCount).toBe(2);
      expect(pData.actualAbsenceDays).toBe(3);
      expect(pData.payableDays).toBe(21);
      expect(pData.monthlySalary).toBe(12000);
      expect(pData.earnedBaseSalary).toBe(10500);
      expect(pData.gross).toBe(12000);
      expect(pData.lop).toBe(1500);
      expect(pData.proposedPenalty).toBe(500);
      expect(pData.appliedPenalty).toBe(500);
      expect(pData.totalAppliedDeductions).toBe(2000);
      expect(pData.netSalary).toBe(10000);

      // 2. Generate
      const genRes = await request(app)
        .post("/api/salaries/generate")
        .send({
          companyId,
          branchId,
          employeeId: testUser._id,
          month: 5,
          year: 2026,
          approvedLeaveDays: 1.5,
          unauthorizedFullDays: 1,
          unauthorizedHalfDays: 1,
          isPenaltyApproved: false,
        });

      expect(genRes.status).toBe(201);
      const gData = genRes.body.data[0];
      expect(gData.workingDays).toBe(24);
      expect(gData.calculationDivisor).toBe(24);
      expect(gData.perDaySalary).toBe(500);
      expect(gData.payableDays).toBe(21);
      expect(gData.earnedBaseSalary).toBe(10500);
      expect(gData.netSalary).toBe(10500);

      // 3. Update (with separate manual unauthorized counts and penalty authorization)
      const updateRes = await request(app)
        .put(`/api/salaries/${gData._id}`)
        .send({
          unauthorizedFullDayCount: 1,
          unauthorizedHalfDayCount: 1,
          isPenaltyApproved: true,
        });

      expect(updateRes.status).toBe(200);
      const uData = updateRes.body.data;
      expect(uData.calendarDays).toBe(31);
      expect(uData.workingDays).toBe(24);
      expect(uData.calculationDivisor).toBe(24);
      expect(uData.perDaySalary).toBe(500);
      expect(uData.approvedLeaveDays).toBe(1.5);
      expect(uData.unauthorizedFullDayCount).toBe(1);
      expect(uData.unauthorizedHalfDayCount).toBe(1);
      expect(uData.penaltyEligibleIncidentCount).toBe(2);
      expect(uData.actualAbsenceDays).toBe(3);
      expect(uData.payableDays).toBe(21);
      expect(uData.earnedBaseSalary).toBe(10500);
      expect(uData.proposedPenalty).toBe(500);
      expect(uData.appliedPenalty).toBe(500);
      expect(uData.totalAppliedDeductions).toBe(2000);
      expect(uData.netSalary).toBe(10000);
    });

    test("PREVENTS automatic recalculation / modification of Approved and Paid records", async () => {
      // 1. Generate record
      const genRes = await request(app)
        .post("/api/salaries/generate")
        .send({
          companyId,
          branchId,
          employeeId: testUser._id,
          month: 5,
          year: 2026,
        });

      const salaryId = genRes.body.data[0]._id;

      // 2. Approve record
      const approveRes = await request(app)
        .post(`/api/salaries/${salaryId}/approve`)
        .send({});
      expect(approveRes.status).toBe(200);

      // 3. Try to regenerate - must fail!
      const regenRes = await request(app)
        .post("/api/salaries/generate")
        .send({
          companyId,
          branchId,
          employeeId: testUser._id,
          month: 5,
          year: 2026,
        });
      expect(regenRes.status).toBe(400);

      // 4. Try to update - must fail!
      const updateRes = await request(app)
        .put(`/api/salaries/${salaryId}`)
        .send({
          basicSalary: 20000,
        });
      expect(updateRes.status).toBe(400);
      expect(updateRes.body.message).toContain("Approved");
    });
  });
});
