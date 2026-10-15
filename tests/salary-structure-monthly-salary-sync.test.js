const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const SalaryStructure = require("../models/SalaryStructure");
const MonthlySalary = require("../models/MonthlySalary");
const Payslip = require("../models/Payslip");
const User = require("../models/User");
const salaryStructureController = require("../controllers/salaryStructureController");

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

  test("editing HRA or other fields in SalaryStructure immediately reflects in MonthlySalary and Payslip", async () => {
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
      hra: 1000,
      specialAllowance: 1000,
      grossSalary: 7000,
      netSalary: 7000,
      status: "Generated",
    });

    expect(monthlySalary.hra).toBe(1000);
    expect(monthlySalary.grossSalary).toBe(7000);

    // 3. Edit HRA in SalaryStructure from 1000 to 2500 using controller update
    const req = {
      params: { id: structure._id.toString() },
      body: { hra: 2500 },
      user: { _id: user._id },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await salaryStructureController.updateSalaryStructure(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    // 4. Verify SalaryStructure updated
    const updatedStructure = await SalaryStructure.findById(structure._id);
    expect(updatedStructure.hra).toBe(2500);
    expect(updatedStructure.grossSalary).toBe(8500); // 5000 + 2500 + 1000

    // 5. Verify MonthlySalary was automatically updated with new HRA & grossSalary
    const updatedMonthlySalary = await MonthlySalary.findById(monthlySalary._id);
    expect(updatedMonthlySalary.hra).toBe(2500);
    expect(updatedMonthlySalary.grossSalary).toBe(8500);
    expect(updatedMonthlySalary.netSalary).toBe(8500);

    // 6. Verify Payslip was also updated
    const payslipDoc = await Payslip.findOne({ payrollId: monthlySalary._id });
    expect(payslipDoc).toBeDefined();
    expect(payslipDoc).not.toBeNull();
    expect(payslipDoc.hra).toBe(2500);
    expect(payslipDoc.grossSalary).toBe(8500);
    expect(payslipDoc.netSalary).toBe(8500);
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
