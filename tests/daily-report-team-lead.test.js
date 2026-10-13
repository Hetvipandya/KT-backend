const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const DailyReport = require("../models/DailyReport");
const Employee = require("../models/Employee");
const Team = require("../models/Team");
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
  await Promise.all([
    DailyReport.deleteMany({}),
    Employee.deleteMany({}),
    Team.deleteMany({}),
    User.deleteMany({}),
  ]);
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

describe("getTeamLeadDailyReports", () => {
  it("returns reports only for employees assigned to the logged-in team lead", async () => {
    const [teamLead, assignedEmployee, unassignedEmployee] = await User.create([
      {
        name: "Team Lead",
        email: "lead@example.com",
        phoneNumber: "9000000001",
        password: "StrongPassword123",
        role: "team lead",
      },
      {
        name: "Assigned Employee",
        email: "assigned@example.com",
        phoneNumber: "9000000002",
        password: "StrongPassword123",
        role: "employee",
      },
      {
        name: "Unassigned Employee",
        email: "unassigned@example.com",
        phoneNumber: "9000000003",
        password: "StrongPassword123",
        role: "employee",
      },
    ]);
    const employee = await Employee.create({
      email: assignedEmployee.email,
      userID: assignedEmployee._id,
    });

    await Team.create({
      teamLeadUser: teamLead._id,
      employees: [employee._id],
    });

    const projectId = new mongoose.Types.ObjectId();
    await DailyReport.create([
      {
        employeeId: assignedEmployee._id,
        projectId,
        todaysWork: "Assigned employee report",
        hoursWorked: 7,
      },
      {
        employeeId: employee._id,
        projectId,
        todaysWork: "Assigned employee report using employee ID",
        hoursWorked: 6,
      },
      {
        employeeId: teamLead._id,
        projectId,
        todaysWork: "Team lead's own report",
        hoursWorked: 8,
      },
      {
        employeeId: unassignedEmployee._id,
        projectId,
        todaysWork: "Unassigned employee report",
        hoursWorked: 8,
      },
    ]);

    const req = {
      user: teamLead,
      query: { teamLeadId: unassignedEmployee._id.toString() },
    };
    const res = createMockRes();

    await dailyReportController.getTeamLeadDailyReports(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.data.map((report) => report.todaysWork)).toEqual(
      expect.arrayContaining([
        "Assigned employee report",
        "Assigned employee report using employee ID",
      ])
    );
  });
});
