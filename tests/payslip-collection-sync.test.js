const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const MonthlySalary = require("../models/MonthlySalary");
const Payslip = require("../models/Payslip");
const User = require("../models/User");

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

describe("Payslip Collection and Synchronization", () => {
  beforeEach(async () => {
    await MonthlySalary.deleteMany({});
    await Payslip.deleteMany({});
    await User.deleteMany({});
  });

  test("explicitly creates 'payslips' collection in database", async () => {
    await Payslip.syncAllMonthlySalariesToPayslips();
    const collections = await mongoose.connection.db.listCollections({ name: "payslips" }).toArray();
    expect(collections.length).toBe(1);
    expect(collections[0].name).toBe("payslips");
  });

  test("automatically creates a Payslip document when a MonthlySalary is saved", async () => {
    const user = await User.create({
      name: "Payroll User",
      email: "payroll-user@example.com",
      phoneNumber: "9876543210",
      password: "Password123!",
      role: "employee",
    });

    const monthlySalary = await MonthlySalary.create({
      userId: user._id,
      employeeId: user._id,
      month: 10,
      year: 2026,
      basicSalary: 30000,
      hra: 10000,
      conveyanceAllowance: 2000,
      medicalAllowance: 1500,
      specialAllowance: 5000,
      grossSalary: 48500,
      pfDeduction: 1800,
      totalDeduction: 1800,
      netSalary: 46700,
      status: "Approved",
    });

    // Check that Payslip document was synced to collection 'payslips'
    const payslipDoc = await Payslip.findOne({ payrollId: monthlySalary._id });
    expect(payslipDoc).toBeDefined();
    expect(payslipDoc).not.toBeNull();
    expect(payslipDoc.userId.toString()).toBe(user._id.toString());
    expect(payslipDoc.month).toBe(10);
    expect(payslipDoc.year).toBe(2026);
    expect(payslipDoc.grossSalary).toBe(48500);
    expect(payslipDoc.netSalary).toBe(46700);
    expect(payslipDoc.basicSalary).toBe(30000);
  });

  test("syncAllMonthlySalariesToPayslips backfills any un-synced monthly salaries into payslips collection", async () => {
    const user = await User.create({
      name: "Backfill User",
      email: "backfill-user@example.com",
      phoneNumber: "9876543211",
      password: "Password123!",
      role: "employee",
    });

    // Insert directly into monthlysalaries collection bypassing mongoose hooks
    const rawSalary = {
      userId: user._id,
      employeeId: user._id,
      month: 9,
      year: 2026,
      basicSalary: 25000,
      grossSalary: 35000,
      netSalary: 33000,
      totalDeduction: 2000,
      status: "PAID",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const insertRes = await mongoose.connection.db.collection("monthlysalaries").insertOne(rawSalary);
    expect(insertRes.insertedId).toBeDefined();

    // Verify payslips is currently empty for this record
    let payslipBefore = await Payslip.findOne({ payrollId: insertRes.insertedId });
    expect(payslipBefore).toBeNull();

    // Run syncAllMonthlySalariesToPayslips
    await Payslip.syncAllMonthlySalariesToPayslips();

    // Verify it is now present in payslips collection
    const payslipAfter = await Payslip.findOne({ payrollId: insertRes.insertedId });
    expect(payslipAfter).toBeDefined();
    expect(payslipAfter).not.toBeNull();
    expect(payslipAfter.grossSalary).toBe(35000);
    expect(payslipAfter.netSalary).toBe(33000);
  });
});
