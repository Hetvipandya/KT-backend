const mongoose = require("mongoose");
const express = require("express");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const SalaryStructure = require("../models/SalaryStructure");
const MonthlySalary = require("../models/MonthlySalary");
const Payslip = require("../models/Payslip");
const User = require("../models/User");
const payrollRoutes = require("../routes/payrollRoutes");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("SalaryStructure update propagation to MonthlySalary and Payslip", () => {
  beforeEach(async () => {
    await SalaryStructure.deleteMany({});
    await MonthlySalary.deleteMany({});
    await Payslip.deleteMany({});
    await User.deleteMany({});
  });

  test("updating any salary structure field through payroll API syncs all unpaid monthly salary fields and payslip", async () => {
    const user = await User.create({
      name: "Test Employee",
      email: "test-emp@example.com",
      phoneNumber: "9876543220",
      password: "Password123!",
      role: "employee",
    });

    // 1. Create initial SalaryStructure with basic: 5000, hra: 1000, special: 1000 -> gross: 7000
    const structure = await SalaryStructure.create({
      userId: user._id,
      employeeId: user._id,
      basicSalary: 5000,
      hra: 1000,
      specialAllowance: 1000,
      autoCalculateStatutory: false,
      pfDeduction: 0,
      esicDeduction: 0,
      professionalTax: 0,
      isActive: true,
    });

    expect(structure.grossSalary).toBe(7000);
    expect(structure.netSalary).toBe(7000);

    // 2. Create MonthlySalary based on this structure
    const monthlySalary = await MonthlySalary.create({
      userId: user._id,
      employeeId: user._id,
      month: 10,
      year: 2026,
      salaryStructureId: structure._id,
      basicSalary: 5000,
      hra: 2000,
      specialAllowance: 1000,
      grossSalary: 8000,
      netSalary: 8000,
      status: "Generated",
    });
    const paidMonthlySalary = await MonthlySalary.create({
      userId: user._id,
      employeeId: user._id,
      month: 9,
      year: 2026,
      salaryStructureId: structure._id,
      basicSalary: 5000,
      hra: 2000,
      specialAllowance: 1000,
      grossSalary: 8000,
      netSalary: 8000,
      status: "Generated",
      paidAt: new Date(),
    });

    expect(monthlySalary.hra).toBe(2000);
    expect(monthlySalary.grossSalary).toBe(8000);

    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { _id: user._id, role: "admin" };
      next();
    });
    app.use("/api/payroll", payrollRoutes);

    const res = await request(app)
      .put(`/api/payroll/update-salary/${structure._id}`)
      .send({ basicSalary: 5500 });

    expect(res.status).toBe(200);

    // 4. Verify SalaryStructure updated
    const updatedStructure = await SalaryStructure.findById(structure._id);
    expect(updatedStructure.basicSalary).toBe(5500);
    expect(updatedStructure.hra).toBe(1000);
    expect(updatedStructure.grossSalary).toBe(7500);

    // 5. Verify MonthlySalary reflects both the changed and unchanged structure values
    const updatedMonthlySalary = await MonthlySalary.findById(monthlySalary._id);
    expect(updatedMonthlySalary.basicSalary).toBe(5500);
    expect(updatedMonthlySalary.hra).toBe(1000);
    expect(updatedMonthlySalary.grossSalary).toBe(7500);
    expect(updatedMonthlySalary.netSalary).toBe(7500);
    const unchangedPaidSalary = await MonthlySalary.findById(paidMonthlySalary._id);
    expect(unchangedPaidSalary.hra).toBe(2000);
    expect(unchangedPaidSalary.basicSalary).toBe(5000);

    // 6. Verify Payslip was also updated
    const payslipDoc = await Payslip.findOne({ payrollId: monthlySalary._id });
    expect(payslipDoc).toBeDefined();
    expect(payslipDoc).not.toBeNull();
    expect(payslipDoc.basicSalary).toBe(5500);
    expect(payslipDoc.hra).toBe(1000);
    expect(payslipDoc.grossSalary).toBe(7500);
    expect(payslipDoc.netSalary).toBe(7500);
  });

  test("editing basicSalary in SalaryStructure propagates to MonthlySalary and recalculates statutory deductions", async () => {
    const user = await User.create({
      name: "Statutory Employee",
      email: "stat-emp@example.com",
      phoneNumber: "9876543221",
      password: "Password123!",
      role: "employee",
    });

    const structure = await SalaryStructure.create({
      userId: user._id,
      employeeId: user._id,
      basicSalary: 10000,
      hra: 4000,
      autoCalculateStatutory: true,
      isActive: true,
    });

    const monthlySalary = await MonthlySalary.create({
      userId: user._id,
      employeeId: user._id,
      month: 10,
      year: 2026,
      salaryStructureId: structure._id,
      basicSalary: 10000,
      hra: 4000,
      grossSalary: structure.grossSalary,
      pfDeduction: structure.pfDeduction,
      esicDeduction: structure.esicDeduction,
      professionalTax: structure.professionalTax,
      totalDeduction: structure.totalDeduction,
      netSalary: structure.netSalary,
      status: "Draft",
    });

    // Update basicSalary directly via save hook
    structure.basicSalary = 15000;
    await structure.save();

    const updatedSalary = await MonthlySalary.findById(monthlySalary._id);
    expect(updatedSalary.basicSalary).toBe(15000);
    expect(updatedSalary.grossSalary).toBe(19000); // 15000 + 4000
    expect(updatedSalary.pfDeduction).toBe(Math.round(15000 * 0.12)); // 1800
  });
});
