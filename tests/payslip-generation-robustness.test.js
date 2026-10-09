const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const MonthlySalary = require("../models/MonthlySalary");
const SalaryStructure = require("../models/SalaryStructure");
const User = require("../models/User");
const salarySlipController = require("../controllers/salarySlipController");

const app = express();
app.use(express.json());
app.all("/api/payroll/payslip/generate", salarySlipController.getSalarySlipHtml);
app.get("/api/salary-slips/:salaryId", salarySlipController.getSalarySlipHtml);
app.get("/api/salary-slips/:salaryId/pdf", salarySlipController.getSalarySlipPdf);

describe("Payslip Generation & Salary Structure Fallback Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Returns JSON 400 error for invalid/missing salary ID instead of raw HTML", async () => {
    const res = await request(app)
      .post("/api/payroll/payslip/generate")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid Salary ID");
  });

  test("Generates payslip JSON when valid payload is passed to /api/payroll/payslip/generate", async () => {
    const mockSalaryId = new mongoose.Types.ObjectId().toString();
    const mockUserId = new mongoose.Types.ObjectId().toString();

    const mockSalary = {
      _id: mockSalaryId,
      employeeId: mockUserId,
      userId: mockUserId,
      month: 10,
      year: 2026,
      grossSalary: 50000,
      netSalary: 45000,
      basicSalary: 25000,
      toObject: () => ({
        _id: mockSalaryId,
        employeeId: mockUserId,
        userId: mockUserId,
        month: 10,
        year: 2026,
        grossSalary: 50000,
        netSalary: 45000,
        basicSalary: 25000,
      }),
    };

    jest.spyOn(MonthlySalary, "findById").mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(mockSalary),
    }));

    const res = await request(app)
      .post("/api/payroll/payslip/generate")
      .send({ salaryId: mockSalaryId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.html).toContain("PAYSLIP");
  });

  test("Falls back to active SalaryStructure if salaryStructureId is missing on MonthlySalary", async () => {
    const mockSalaryId = new mongoose.Types.ObjectId().toString();
    const mockUserId = new mongoose.Types.ObjectId().toString();

    const mockSalary = {
      _id: mockSalaryId,
      employeeId: mockUserId,
      userId: mockUserId,
      salaryStructureId: null, // missing reference
      month: 10,
      year: 2026,
      toObject: () => ({
        _id: mockSalaryId,
        employeeId: mockUserId,
        userId: mockUserId,
        salaryStructureId: null,
        month: 10,
        year: 2026,
      }),
    };

    const mockStructure = {
      _id: new mongoose.Types.ObjectId().toString(),
      basicSalary: 30000,
      hra: 12000,
      grossSalary: 60000,
      netSalary: 52000,
      toObject: () => ({
        basicSalary: 30000,
        hra: 12000,
        grossSalary: 60000,
        netSalary: 52000,
      }),
    };

    jest.spyOn(MonthlySalary, "findById").mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(mockSalary),
    }));

    const mockQuery = Promise.resolve(mockStructure);
    mockQuery.sort = jest.fn().mockResolvedValue(mockStructure);
    jest.spyOn(SalaryStructure, "findOne").mockReturnValue(mockQuery);

    const res = await request(app)
      .post("/api/payroll/payslip/generate")
      .send({ salaryId: mockSalaryId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payslip.grossSalary).toBe(60000);
  });
});
