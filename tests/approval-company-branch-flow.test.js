jest.mock("../services/email.service", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendTemporaryPasswordEmail: jest.fn().mockResolvedValue(true),
}));

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

const User = require("../models/User");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const Branch = require("../models/Branch");
const MonthlySalary = require("../models/MonthlySalary");
const SalaryStructure = require("../models/SalaryStructure");

const userRoutes = require("../routes/userRoutes");
const monthlySalaryRoutes = require("../routes/monthlySalaryRoutes");
const payrollRoutes = require("../routes/payrollRoutes");

const emailService = require("../services/email.service");

describe("Approval Workflow with Company and Branch Selection", () => {
  let app;
  let mockUserId;
  let mockCompanyId;
  let mockBranchId;
  let mockUserDoc;
  let mockEmployeeDoc;
  let mockSalaryDoc;

  beforeAll(() => {
    mockUserId = new mongoose.Types.ObjectId();
    mockCompanyId = new mongoose.Types.ObjectId();
    mockBranchId = new mongoose.Types.ObjectId();

    app = express();
    app.use(express.json());

    // Mock admin auth for protected routes
    app.use((req, res, next) => {
      req.user = {
        _id: new mongoose.Types.ObjectId(),
        role: "admin",
        name: "Admin Tester",
      };
      next();
    });

    app.use("/api/users", userRoutes);
    app.use("/api/salaries", monthlySalaryRoutes);
    app.use("/api/payroll", payrollRoutes);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(emailService, "sendTemporaryPasswordEmail").mockResolvedValue(true);

    mockUserDoc = {
      _id: mockUserId,
      name: "Rohan Patel",
      email: "rohan@example.com",
      role: "employee",
      isApproved: false,
      status: "Inactive",
      companyId: null,
      branchId: null,
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
    };

    mockEmployeeDoc = {
      _id: new mongoose.Types.ObjectId(),
      userID: mockUserId,
      employeeID: "EMP-001",
      companyId: null,
      branchId: null,
      designation: "Software Engineer",
      joiningDate: new Date(),
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
    };

    mockSalaryDoc = {
      _id: new mongoose.Types.ObjectId(),
      employeeId: mockUserId,
      userId: mockUserId,
      companyId: null,
      branchId: null,
      status: "Generated",
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
    };
  });

  describe("1. User Approval Flow (PUT & POST /api/users/approve)", () => {
    test("approves user and assigns selected companyId and branchId", async () => {
      jest.spyOn(User, "findById").mockResolvedValue(mockUserDoc);
      jest.spyOn(Employee, "findOne").mockResolvedValue(mockEmployeeDoc);
      jest.spyOn(SalaryStructure, "updateMany").mockResolvedValue({ modifiedCount: 1 });
      jest.spyOn(MonthlySalary, "updateMany").mockResolvedValue({ modifiedCount: 1 });

      const res = await request(app)
        .put("/api/users/approve")
        .send({
          userId: mockUserId.toString(),
          companyId: mockCompanyId.toString(),
          branchId: mockBranchId.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("Employee approved successfully");
      expect(mockUserDoc.isApproved).toBe(true);
      expect(mockUserDoc.status).toBe("Active");
      expect(mockUserDoc.companyId.toString()).toBe(mockCompanyId.toString());
      expect(mockUserDoc.branchId.toString()).toBe(mockBranchId.toString());
      expect(mockEmployeeDoc.companyId.toString()).toBe(mockCompanyId.toString());
      expect(mockEmployeeDoc.branchId.toString()).toBe(mockBranchId.toString());
      expect(res.body.data.companyId.toString()).toBe(mockCompanyId.toString());
      expect(res.body.data.branchId.toString()).toBe(mockBranchId.toString());
    });

    test("supports POST /api/users/approve as well as PUT", async () => {
      jest.spyOn(User, "findById").mockResolvedValue(mockUserDoc);
      jest.spyOn(Employee, "findOne").mockResolvedValue(mockEmployeeDoc);

      const res = await request(app)
        .post("/api/users/approve")
        .send({
          userId: mockUserId.toString(),
          companyId: mockCompanyId.toString(),
          branchId: mockBranchId.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("validates invalid companyId and branchId formats", async () => {
      jest.spyOn(User, "findById").mockResolvedValue(mockUserDoc);

      const invalidRes = await request(app)
        .put("/api/users/approve")
        .send({
          userId: mockUserId.toString(),
          companyId: "invalid-company-id",
        });

      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.success).toBe(false);
      expect(invalidRes.body.message).toContain("Invalid companyId");
    });
  });

  describe("2. Monthly Salary / Payroll Approval Flow", () => {
    test("POST /api/salaries/:id/approve updates salary status, companyId and branchId", async () => {
      jest.spyOn(MonthlySalary, "findById").mockImplementation(() => {
        return {
          populate: jest.fn().mockReturnThis(),
          then: function (resolve) {
            return resolve(mockSalaryDoc);
          },
        };
      });

      const res = await request(app)
        .post(`/api/salaries/${mockSalaryDoc._id}/approve`)
        .send({
          companyId: mockCompanyId.toString(),
          branchId: mockBranchId.toString(),
          remarks: "Approved by finance manager",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSalaryDoc.status).toBe("Approved");
      expect(mockSalaryDoc.companyId.toString()).toBe(mockCompanyId.toString());
      expect(mockSalaryDoc.branchId.toString()).toBe(mockBranchId.toString());
      expect(mockSalaryDoc.remarks).toBe("Approved by finance manager");
    });

    test("POST /api/payroll/approve routes to approval handler and processes approval", async () => {
      jest.spyOn(MonthlySalary, "findById").mockImplementation(() => {
        return {
          populate: jest.fn().mockReturnThis(),
          then: function (resolve) {
            return resolve(mockSalaryDoc);
          },
        };
      });

      const res = await request(app)
        .post("/api/payroll/approve")
        .send({
          id: mockSalaryDoc._id.toString(),
          companyId: mockCompanyId.toString(),
          branchId: mockBranchId.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSalaryDoc.status).toBe("Approved");
    });
  });
});
