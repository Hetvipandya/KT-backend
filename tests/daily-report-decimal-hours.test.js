const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const DailyReport = require("../models/DailyReport");
const User = require("../models/User");
const dailyReportController = require("../controllers/dailyReportController");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await DailyReport.deleteMany({});
  await User.deleteMany({});
});

const createMockRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

describe("Daily Report Decimal Hours Support", () => {
  it("helper parseHoursWorked correctly parses decimal, string, and colon formats", () => {
    const { parseHoursWorked } = dailyReportController;
    expect(parseHoursWorked(7.32)).toBe(7.32);
    expect(parseHoursWorked("7.32")).toBe(7.32);
    expect(parseHoursWorked("7,32")).toBe(7.32);
    expect(parseHoursWorked("7:32")).toBe(7.32);
    expect(parseHoursWorked("7:05")).toBe(7.05);
    expect(parseHoursWorked(8)).toBe(8);
    expect(parseHoursWorked("invalid")).toBeNull();
    expect(parseHoursWorked(null)).toBeNull();
  });

  it("creates daily report with exact decimal hoursWorked (7.32) when passed as a number", async () => {
    const user = await User.create({
      name: "Hetvi Pandya",
      email: "hetvi@example.com",
      password: "StrongPassword123",
      role: "employee",
      isApproved: true,
    });

    const projectId = new mongoose.Types.ObjectId();
    const res = createMockRes();

    await dailyReportController.createDailyReport(
      {
        body: {
          employeeId: user._id.toString(),
          projectId: projectId.toString(),
          todaysWork: "Implemented backend API and decimal hours support",
          hoursWorked: 7.32,
          submit: true,
        },
      },
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hoursWorked).toBe(7.32);

    const savedInDb = await DailyReport.findById(res.body.data._id);
    expect(savedInDb.hoursWorked).toBe(7.32);
  });

  it("creates daily report with decimal hoursWorked when passed as a string '7.32'", async () => {
    const user = await User.create({
      name: "Hetvi Pandya",
      email: "hetvi2@example.com",
      password: "StrongPassword123",
      role: "employee",
      isApproved: true,
    });

    const projectId = new mongoose.Types.ObjectId();
    const res = createMockRes();

    await dailyReportController.createDailyReport(
      {
        body: {
          employeeId: user._id.toString(),
          projectId: projectId.toString(),
          todaysWork: "Testing string decimal hours",
          hoursWorked: "7.32",
          submit: true,
        },
      },
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hoursWorked).toBe(7.32);

    const saved = await DailyReport.findById(res.body.data._id);
    expect(saved.hoursWorked).toBe(7.32);
  });

  it("creates daily report with colon format '7:32' converting to 7.32", async () => {
    const user = await User.create({
      name: "Hetvi Pandya",
      email: "hetvi3@example.com",
      password: "StrongPassword123",
      role: "employee",
      isApproved: true,
    });

    const projectId = new mongoose.Types.ObjectId();
    const res = createMockRes();

    await dailyReportController.createDailyReport(
      {
        body: {
          employeeId: user._id.toString(),
          projectId: projectId.toString(),
          todaysWork: "Testing time colon format",
          hoursWorked: "7:32",
          submit: true,
        },
      },
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hoursWorked).toBe(7.32);
  });

  it("updates existing daily report with decimal hoursWorked via updateDailyReport", async () => {
    const user = await User.create({
      name: "Hetvi Pandya",
      email: "hetvi4@example.com",
      password: "StrongPassword123",
      role: "employee",
      isApproved: true,
    });

    const report = await DailyReport.create({
      employeeId: user._id,
      projectId: new mongoose.Types.ObjectId(),
      todaysWork: "Initial report with 7 hours",
      hoursWorked: 7,
    });

    const updateRes = createMockRes();
    await dailyReportController.updateDailyReport(
      {
        params: { id: report._id.toString() },
        body: {
          hoursWorked: 7.32,
          todaysWork: "Updated report with 7.32 hours",
        },
      },
      updateRes
    );

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.hoursWorked).toBe(7.32);

    const reloaded = await DailyReport.findById(report._id);
    expect(reloaded.hoursWorked).toBe(7.32);
    expect(reloaded.todaysWork).toBe("Updated report with 7.32 hours");
  });

  it("retrieves reports with exact decimal hours intact in getAllDailyReports and getSingleDailyReport", async () => {
    const user = await User.create({
      name: "Hetvi Pandya",
      email: "hetvi5@example.com",
      password: "StrongPassword123",
      role: "employee",
      isApproved: true,
    });

    const created = await DailyReport.create({
      employeeId: user._id,
      projectId: new mongoose.Types.ObjectId(),
      todaysWork: "Working 7.32 hours",
      hoursWorked: 7.32,
    });

    // Test get single
    const singleRes = createMockRes();
    await dailyReportController.getSingleDailyReport(
      { params: { id: created._id.toString() } },
      singleRes
    );
    expect(singleRes.statusCode).toBe(200);
    expect(singleRes.body.data.hoursWorked).toBe(7.32);

    // Test get all
    const listRes = createMockRes();
    await dailyReportController.getAllDailyReports(
      { query: {} },
      listRes
    );
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.data[0].hoursWorked).toBe(7.32);
  });

  it("employeePanelController.submitBatchDailyReport saves decimal hours 7.32 properly", async () => {
    const employeePanelController = require("../controllers/employeePanelController");
    const user = await User.create({
      name: "Hetvi Pandya",
      email: "hetvi6@example.com",
      password: "StrongPassword123",
      role: "employee",
      isApproved: true,
    });

    const projectId = new mongoose.Types.ObjectId();
    const batchRes = createMockRes();

    await employeePanelController.submitBatchDailyReport(
      {
        user: { _id: user._id },
        body: {
          reports: [
            {
              projectId: projectId.toString(),
              todaysWork: "Batch decimal report",
              hoursWorked: 7.32,
            },
            {
              projectId: projectId.toString(),
              todaysWork: "Batch colon decimal report",
              hoursWorked: "7:32",
            },
          ],
        },
      },
      batchRes
    );

    expect(batchRes.statusCode).toBe(201);
    expect(batchRes.body.success).toBe(true);
    expect(batchRes.body.count).toBe(2);
    expect(batchRes.body.data[0].hoursWorked).toBe(7.32);
    expect(batchRes.body.data[1].hoursWorked).toBe(7.32);
  });
});

