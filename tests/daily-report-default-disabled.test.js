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

describe("daily report creation safety", () => {
  it("does not create a daily report by default unless submit is explicitly enabled", async () => {
    const user = await User.create({
      name: "Aarav Shah",
      email: "aarav@example.com",
      password: "StrongPass123",
      role: "employee",
      isApproved: true,
    });

    const res = {
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
    };

    await dailyReportController.createDailyReport(
      {
        body: {
          employeeId: user._id.toString(),
          projectId: new mongoose.Types.ObjectId().toString(),
          todaysWork: "Completed login flow QA",
          hoursWorked: 8,
        },
      },
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(await DailyReport.countDocuments()).toBe(0);
  });

  it("creates a daily report when the submission flag is explicitly set", async () => {
    const user = await User.create({
      name: "Meera Joshi",
      email: "meera@example.com",
      password: "StrongPass123",
      role: "employee",
      isApproved: true,
    });

    const res = {
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
    };

    await dailyReportController.createDailyReport(
      {
        body: {
          employeeId: user._id.toString(),
          projectId: new mongoose.Types.ObjectId().toString(),
          todaysWork: "Worked on report export",
          hoursWorked: 7,
          submit: true,
        },
      },
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(await DailyReport.countDocuments()).toBe(1);
  });
});
