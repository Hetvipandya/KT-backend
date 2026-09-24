const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
require("../models/projectModel");
const TaskManagement = require("../models/TaskManagement");
const User = require("../models/User");
const Employee = require("../models/Employee");
const taskManagementController = require("../controllers/taskManagementController");

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
  await TaskManagement.deleteMany({});
  await User.deleteMany({});
  await Employee.deleteMany({});
});

describe("task management milestone handling", () => {
  it("allows creating a project-scoped task without a milestone", async () => {
    const task = new TaskManagement({
      projectId: new mongoose.Types.ObjectId(),
      taskTitle: "Landing page review",
      assignedEmployee: new mongoose.Types.ObjectId(),
      assignedBy: new mongoose.Types.ObjectId(),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await expect(task.validate()).resolves.toBeUndefined();
    expect(task.milestoneId).toBeUndefined();
  });

  it("returns tasks when employee lookup resolves to the linked user id", async () => {
    const user = await User.create({
      name: "Rahul Shah",
      email: "rahul@example.com",
      password: "StrongPass123",
      role: "employee",
      isApproved: true,
    });

    const employee = await Employee.create({
      name: "Rahul Shah",
      email: "rahul@example.com",
      userID: user._id,
      userId: user._id,
    });

    await TaskManagement.create({
      projectId: new mongoose.Types.ObjectId(),
      taskTitle: "Review design",
      assignedEmployee: user._id,
      assignedBy: user._id,
      dueDate: new Date(Date.now() + 86400000),
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

    await taskManagementController.getTasksByEmployeeId(
      { params: { employeeId: employee._id.toString() } },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].assignedEmployee?._id?.toString() || res.body.data[0].assignedEmployee?.toString()).toBe(user._id.toString());
  });
});
