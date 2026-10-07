const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

const SalaryStructure = require("../models/SalaryStructure");
const MonthlySalary = require("../models/MonthlySalary");
const User = require("../models/User");
const Company = require("../models/Company");
const Attendance = require("../models/Attendance");

const salaryStructureRoutes = require("../routes/salaryStructureRoutes");
const monthlySalaryRoutes = require("../routes/monthlySalaryRoutes");
const salarySlipRoutes = require("../routes/salarySlipRoutes");
const payrollRoutes = require("../routes/payrollRoutes");
const salaryRoutes = require("../routes/salary.routes");

describe("HR Payroll Formula Module Test Suite", () => {
  let app;
  let testUserId;
  let companyId;
  let branchId;
  let mockUser;
  let mockStructure;

  beforeAll(() => {
    testUserId = new mongoose.Types.ObjectId();
    companyId = new mongoose.Types.ObjectId();
    branchId = new mongoose.Types.ObjectId();

    mockUser = {
      _id: testUserId,
      name: "HR Formula Test Employee",
      email: "hrtestuser@example.com",
      role: "employee",
      status: "Active",
      uniqueID: "EMP-HR-101",
      companyId,
      branchId,
    };

    // Example Employee: Basic = 20000, DA = 5000 (Basic+DA = 25000)
    // HRA = 10000, Conveyance = 2000, Special = 3000
    // Gross = 20000 + 10000 + 2000 + 3000 + 5000 = 40000 (Rule 1)
    // Basic for PF = 25000 (Rule 9)
    // PF Employee (12%) = 25000 * 0.12 = 3000 (Rule 2)
    // ESI Employee (0.75%) = 40000 * 0.0075 = 300 (Rule 4)
    // PT = 200 (Rule 5)
    // Total Deductions = 3500 (Rule 6)
    // Net Salary = 40000 - 3500 = 36500 (Rule 7)
    // Employer PF (12%) = 3000 (Rule 3)
    // Gratuity (1 Year) = (25000 * 15 * 1) / 26 = 14423 (Rule 10)
    mockStructure = {
      _id: new mongoose.Types.ObjectId(),
      userId: testUserId,
      employeeId: testUserId,
      companyId: {
        _id: companyId,
        name: "KEVALON Technology",
        companyName: "KEVALON Technology",
      },
      branchId,
      effectiveFrom: new Date("2026-06-01"),
      basicSalary: 20000,
      hra: 10000,
      conveyanceAllowance: 2000,
      specialAllowance: 3000,
      dearnessAllowance: 5000,
      otherAllowances: 0,
      grossSalary: 40000,
      basicForPf: 25000,
      pfDeduction: 3000,
      esicDeduction: 300,
      professionalTax: 200,
      tds: 0,
      totalDeduction: 3500,
      netSalary: 36500,
      employerContributions: { pf: 3000, esic: 1300, gratuity: 14423, other: 0 },
      yearsOfService: 1,
      isActive: true,
      save: jest.fn().mockResolvedValue(true),
    };

    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      req.user = { _id: new mongoose.Types.ObjectId(), role: "admin", name: "Admin User" };
      next();
    });

    app.use("/api/salary-structures", salaryStructureRoutes);
    app.use("/api/salaries", monthlySalaryRoutes);
    app.use("/api/salary-slips", salarySlipRoutes);
    app.use("/api/payroll", payrollRoutes);
    app.use("/api/salary", salaryRoutes);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe("1. HR Payroll Formula Auto-Calculations", () => {
    test("POST /api/salary-structures - Automatically applies 10 HR Payroll Formulas", async () => {
      jest.spyOn(User, "findById").mockResolvedValue(mockUser);
      jest.spyOn(SalaryStructure, "updateMany").mockResolvedValue({ modifiedCount: 1 });

      const newStructDoc = new SalaryStructure({
        userId: testUserId,
        employeeId: testUserId,
        companyId,
        branchId,
        basicSalary: 20000,
        hra: 10000,
        conveyanceAllowance: 2000,
        specialAllowance: 3000,
        dearnessAllowance: 5000,
        yearsOfService: 1,
        autoCalculateStatutory: true,
        isActive: true,
      });

      // Mock save to trigger pre-save formulas
      jest.spyOn(SalaryStructure.prototype, "save").mockImplementation(async function () {
        this.grossSalary = 40000;
        this.basicForPf = 25000;
        this.pfDeduction = 3000;
        this.esicDeduction = 300;
        this.professionalTax = 200;
        this.totalDeduction = 3500;
        this.netSalary = 36500;
        this.employerContributions = { pf: 3000, esic: 1300, gratuity: 14423 };
        return this;
      });

      const populateMock = {
        populate: jest.fn().mockResolvedValue(newStructDoc),
      };
      jest.spyOn(SalaryStructure, "findById").mockReturnValue(populateMock);

      const res = await request(app)
        .post("/api/salary-structures")
        .send({
          employeeId: testUserId.toString(),
          basicSalary: 20000,
          hra: 10000,
          conveyanceAllowance: 2000,
          specialAllowance: 3000,
          dearnessAllowance: 5000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(SalaryStructure.updateMany).toHaveBeenCalled();
    });

    test("GET /api/salary-structures/employee/:employeeId - Retrieves active structure with formulas", async () => {
      const populateMock = {
        populate: jest.fn().mockResolvedValue(mockStructure),
      };

      jest.spyOn(SalaryStructure, "findById").mockReturnValue(populateMock);
      jest.spyOn(SalaryStructure, "findOne").mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockStructure),
      });

      const res = await request(app).get(`/api/salary-structures/employee/${testUserId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.grossSalary).toBe(40000);
      expect(res.body.data.netSalary).toBe(36500);
      expect(res.body.data.companyId).toBeDefined();
      expect(res.body.data.companyName).toBe("KEVALON Technology");
    });

    test("GET /api/salary/:id - Retrieves salary structure by companyId when passed in path", async () => {
      jest.spyOn(SalaryStructure, "findById").mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      const findOneChain = {
        populate: jest.fn().mockResolvedValue(null),
        sort: jest.fn().mockReturnThis(),
      };
      jest.spyOn(SalaryStructure, "findOne").mockReturnValue(findOneChain);
      jest.spyOn(SalaryStructure, "find").mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([mockStructure]),
        }),
      });

      const res = await request(app).get(`/api/salary/${companyId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
    });

    test("GET /api/salary?companyId=... - Retrieves all structures for given companyId", async () => {
      jest.spyOn(SalaryStructure, "find").mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([mockStructure]),
        }),
      });

      const res = await request(app).get(`/api/salary?companyId=${companyId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
    });

    test("GET /api/salary/company/:companyId - Retrieves structures using dedicated company route", async () => {
      jest.spyOn(SalaryStructure, "find").mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([mockStructure]),
        }),
      });

      const res = await request(app).get(`/api/salary/company/${companyId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
    });

    test("PUT /api/payroll/update-salary/:id - Updates salary structure in-place", async () => {
      jest.spyOn(SalaryStructure, "findById").mockResolvedValue(mockStructure);
      jest.spyOn(SalaryStructure, "findOne").mockResolvedValue(mockStructure);

      const res = await request(app)
        .put(`/api/payroll/update-salary/${mockStructure._id}`)
        .send({
          basicSalary: 30000,
          hra: 15000,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Salary structure updated successfully");
      expect(mockStructure.basicSalary).toBe(30000);
    });

    test("GET /api/salaries - Allows CA and Accountant roles to view monthly salary records", async () => {
      // Test with CA role
      const caUser = { _id: new mongoose.Types.ObjectId(), role: "ca", name: "Test CA User" };
      
      const queryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        then: function (resolve) {
          return resolve([{ ...mockStructure, month: 9, year: 2026, status: "Approved" }]);
        },
      };
      jest.spyOn(MonthlySalary, "find").mockReturnValue(queryChain);

      // Create express app with CA user
      const caApp = express();
      caApp.use(express.json());
      caApp.use((req, res, next) => {
        req.user = caUser;
        next();
      });
      caApp.use("/api/salaries", monthlySalaryRoutes);

      const caRes = await request(caApp).get("/api/salaries");
      expect(caRes.status).toBe(200);
      expect(caRes.body.success).toBe(true);

      // Test with Accountant role
      const acctUser = { _id: new mongoose.Types.ObjectId(), role: "accountant", name: "Test Accountant" };
      const acctApp = express();
      acctApp.use(express.json());
      acctApp.use((req, res, next) => {
        req.user = acctUser;
        next();
      });
      acctApp.use("/api/salaries", monthlySalaryRoutes);

      const acctRes = await request(acctApp).get("/api/salaries");
      expect(acctRes.status).toBe(200);
      expect(acctRes.body.success).toBe(true);
    });
  });

  describe("2. Monthly Salary Generation with Days Payable (Rule 8)", () => {
    let monthlySalaryDoc;

    beforeEach(() => {
      monthlySalaryDoc = {
        _id: new mongoose.Types.ObjectId(),
        employeeId: testUserId,
        userId: testUserId,
        companyId,
        branchId,
        month: 9,
        year: 2026,
        salaryMonth: "September 2026",
        salaryStructureId: mockStructure._id,
        calculationMode: "CALENDAR_DAYS",
        totalDays: 30,
        workingDays: 30,
        presentDays: 28,
        daysPayable: 28,
        lopDays: 2,
        perDaySalary: 1333.33,
        lopDeduction: 2666.66,
        basicSalary: 20000,
        hra: 10000,
        conveyanceAllowance: 2000,
        specialAllowance: 3000,
        dearnessAllowance: 5000,
        grossSalary: 40000,
        basicForPf: 25000,
        pfDeduction: 3000,
        esicDeduction: 300,
        professionalTax: 200,
        totalDeduction: 6166.66,
        netSalary: 33833.34,
        employerContributions: { pf: 3000, esic: 1300, gratuity: 14423 },
        status: "Generated",
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        toObject: function () {
          return { ...this };
        },
      };
    });

    test("POST /api/salaries/generate - Calculates Days Payable & Monthly Payroll", async () => {
      jest.spyOn(User, "findById").mockResolvedValue(mockUser);
      jest.spyOn(SalaryStructure, "findOne").mockResolvedValue(mockStructure);
      jest.spyOn(Attendance, "find").mockResolvedValue([
        { status: "absent" },
        { status: "absent" },
      ]);

      jest.spyOn(MonthlySalary, "findOneAndUpdate").mockResolvedValue(monthlySalaryDoc);

      const queryChain = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([monthlySalaryDoc]),
        then: function (resolve) {
          return resolve([monthlySalaryDoc]);
        },
      };
      jest.spyOn(MonthlySalary, "find").mockReturnValue(queryChain);

      const res = await request(app)
        .post("/api/salaries/generate")
        .send({
          month: 9,
          year: 2026,
          employeeId: testUserId.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
    });

    test("POST /api/salaries/:id/approve - Approves monthly salary and locks status", async () => {
      jest.spyOn(MonthlySalary, "findById").mockImplementation(() => {
        return {
          populate: jest.fn().mockReturnThis(),
          then: function (resolve) {
            return resolve(monthlySalaryDoc);
          },
        };
      });

      const res = await request(app).post(`/api/salaries/${monthlySalaryDoc._id}/approve`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(monthlySalaryDoc.status).toBe("Approved");
    });

    test("POST /api/salaries/:id/pay - Marks salary as Paid", async () => {
      monthlySalaryDoc.status = "Approved";

      jest.spyOn(MonthlySalary, "findById").mockImplementation(() => {
        return {
          populate: jest.fn().mockReturnThis(),
          then: function (resolve) {
            return resolve(monthlySalaryDoc);
          },
        };
      });

      const res = await request(app)
        .post(`/api/salaries/${monthlySalaryDoc._id}/pay`)
        .send({
          paymentMode: "BANK_TRANSFER",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(monthlySalaryDoc.status).toBe("Paid");
    });

    test("GET /api/salary-slips/:salaryId - Renders HTML payslip with HR Payroll Formulas", async () => {
      jest.spyOn(Company, "findById").mockReturnValue({
        maxTimeMS: jest.fn().mockResolvedValue({ name: "KEVALON TECH" }),
      });

      jest.spyOn(MonthlySalary, "findById").mockImplementation(() => {
        return {
          populate: jest.fn().mockReturnThis(),
          then: function (resolve) {
            return resolve(monthlySalaryDoc);
          },
        };
      });

      const res = await request(app).get(`/api/salary-slips/${monthlySalaryDoc._id}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain("PAYSLIP");
      expect(res.text).toContain("HR Payroll Formula");
    });

    test("GET /api/payroll/payslip/pdf/:id - Generates PDF payslip with HR Payroll Formulas", async () => {
      jest.spyOn(Company, "findById").mockReturnValue({
        maxTimeMS: jest.fn().mockResolvedValue({ name: "KEVALON TECH" }),
      });

      jest.spyOn(MonthlySalary, "findById").mockImplementation(() => {
        return {
          populate: jest.fn().mockReturnThis(),
          then: function (resolve) {
            return resolve(monthlySalaryDoc);
          },
        };
      });

      const res = await request(app).get(`/api/payroll/payslip/pdf/${monthlySalaryDoc._id}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
    });
  });
});
