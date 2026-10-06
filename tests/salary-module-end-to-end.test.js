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

describe("Salary Module End-to-End Test Suite", () => {
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
      name: "Salary Test Employee",
      email: "salarytestuser@example.com",
      role: "employee",
      status: "Active",
      uniqueID: "EMP-SALARY-101",
      companyId,
      branchId,
    };

    mockStructure = {
      _id: new mongoose.Types.ObjectId(),
      userId: testUserId,
      employeeId: testUserId,
      companyId,
      branchId,
      effectiveFrom: new Date("2026-06-01"),
      basicSalary: 25000,
      hra: 10000,
      conveyanceAllowance: 2000,
      medicalAllowance: 1500,
      specialAllowance: 6500,
      otherAllowances: 0,
      grossSalary: 45000,
      pfDeduction: 1800,
      esicDeduction: 0,
      professionalTax: 200,
      tds: 1000,
      totalDeduction: 3000,
      netSalary: 42000,
      isActive: true,
      save: jest.fn().mockResolvedValue(true),
    };

    app = express();
    app.use(express.json());

    // Middleware to simulate authenticated admin user
    app.use((req, res, next) => {
      req.user = { _id: new mongoose.Types.ObjectId(), role: "admin", name: "Admin User" };
      next();
    });

    app.use("/api/salary-structures", salaryStructureRoutes);
    app.use("/api/salaries", monthlySalaryRoutes);
    app.use("/api/salary-slips", salarySlipRoutes);
    app.use("/api/payroll", payrollRoutes);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe("1. Salary Structure Management", () => {
    test("POST /api/salary-structures - Creates new active structure & deactivates previous", async () => {
      jest.spyOn(User, "findById").mockResolvedValue(mockUser);
      jest.spyOn(SalaryStructure, "updateMany").mockResolvedValue({ modifiedCount: 1 });

      const newStructDoc = new SalaryStructure({
        userId: testUserId,
        employeeId: testUserId,
        companyId,
        branchId,
        basicSalary: 25000,
        hra: 10000,
        conveyanceAllowance: 2000,
        medicalAllowance: 1500,
        specialAllowance: 6500,
        pfDeduction: 1800,
        professionalTax: 200,
        tds: 1000,
        isActive: true,
      });

      jest.spyOn(SalaryStructure.prototype, "save").mockResolvedValue(newStructDoc);

      const populateMock = {
        populate: jest.fn().mockResolvedValue(newStructDoc),
      };
      jest.spyOn(SalaryStructure, "findById").mockReturnValue(populateMock);

      const res = await request(app)
        .post("/api/salary-structures")
        .send({
          employeeId: testUserId.toString(),
          basicSalary: 25000,
          hra: 10000,
          conveyanceAllowance: 2000,
          medicalAllowance: 1500,
          specialAllowance: 6500,
          pfDeduction: 1800,
          professionalTax: 200,
          tds: 1000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(SalaryStructure.updateMany).toHaveBeenCalled();
    });

    test("GET /api/salary-structures/employee/:employeeId - Retrieves active structure", async () => {
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
      expect(res.body.data._id.toString()).toBe(mockStructure._id.toString());
    });

    test("PUT /api/payroll/update-salary/:id - Updates existing salary structure in-place", async () => {
      jest.spyOn(SalaryStructure, "findById").mockResolvedValue(mockStructure);
      jest.spyOn(SalaryStructure, "findOne").mockResolvedValue(mockStructure);

      const res = await request(app)
        .put(`/api/payroll/update-salary/${mockStructure._id}`)
        .send({
          basicSalary: 30000,
          hra: 12000,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Salary structure updated successfully");
      expect(mockStructure.basicSalary).toBe(30000);
      expect(mockStructure.hra).toBe(12000);
    });
  });

  describe("2. Monthly Salary Generation & Workflow", () => {
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
        presentDays: 28,
        lopDays: 2,
        perDaySalary: 1500,
        lopDeduction: 3000,
        basicSalary: 25000,
        hra: 10000,
        conveyanceAllowance: 2000,
        medicalAllowance: 1500,
        specialAllowance: 6500,
        grossSalary: 45000,
        pfDeduction: 1800,
        professionalTax: 200,
        tds: 1000,
        totalDeduction: 6000,
        netSalary: 39000,
        status: "Generated",
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
        toObject: function () {
          return { ...this };
        },
      };
    });

    test("POST /api/salaries/generate - Generates monthly salary with LOP deduction", async () => {
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
      jest.spyOn(MonthlySalary, "findById").mockImplementation((id) => {
        const queryChain = {
          populate: jest.fn().mockReturnThis(),
          then: function (resolve) {
            return resolve(monthlySalaryDoc);
          },
        };
        return queryChain;
      });

      const res = await request(app).post(`/api/salaries/${monthlySalaryDoc._id}/approve`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(monthlySalaryDoc.status).toBe("Approved");
    });

    test("POST /api/salaries/:id/pay - Marks salary as Paid", async () => {
      monthlySalaryDoc.status = "Approved";

      jest.spyOn(MonthlySalary, "findById").mockImplementation((id) => {
        const queryChain = {
          populate: jest.fn().mockReturnThis(),
          then: function (resolve) {
            return resolve(monthlySalaryDoc);
          },
        };
        return queryChain;
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

    test("GET /api/salary-slips/:salaryId - Renders HTML salary slip view", async () => {
      jest.spyOn(Company, "findById").mockReturnValue({
        maxTimeMS: jest.fn().mockResolvedValue({ name: "KEVALON TECH" }),
      });

      jest.spyOn(MonthlySalary, "findById").mockImplementation(() => {
        const queryChain = {
          populate: jest.fn().mockReturnThis(),
          then: function (resolve) {
            return resolve(monthlySalaryDoc);
          },
        };
        return queryChain;
      });

      const res = await request(app).get(`/api/salary-slips/${monthlySalaryDoc._id}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain("PAYSLIP");
      expect(res.text).toContain("Gross Earnings");
    });

    test("GET /api/payroll/payslip/pdf/:id - Generates styled PDF salary slip", async () => {
      jest.spyOn(Company, "findById").mockReturnValue({
        maxTimeMS: jest.fn().mockResolvedValue({ name: "KEVALON TECH" }),
      });

      jest.spyOn(MonthlySalary, "findById").mockImplementation(() => {
        const queryChain = {
          populate: jest.fn().mockReturnThis(),
          then: function (resolve) {
            return resolve(monthlySalaryDoc);
          },
        };
        return queryChain;
      });

      const res = await request(app).get(`/api/payroll/payslip/pdf/${monthlySalaryDoc._id}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
    });
  });
});
