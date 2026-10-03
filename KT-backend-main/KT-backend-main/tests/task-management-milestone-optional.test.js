const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
require("../models/projectModel");
const TaskManagement = require("../models/taskModel");
const User = require("../models/User");
const Employee = require("../models/Employee");
const projectController = require("../controllers/projectController");
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
    const task = await TaskManagement.create({
      projectId: new mongoose.Types.ObjectId(),
      taskTitle: "Landing page review",
      assignedEmployee: new mongoose.Types.ObjectId(),
      assignedBy: new mongoose.Types.ObjectId(),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const populatedTask = await TaskManagement.findById(task._id).populate("milestoneId", "title");
    expect(task.milestoneId).toBeUndefined();
    expect(populatedTask.milestoneId).toBeUndefined();
  });

  it("does not auto-create tasks when a project is created with assigned employees", async () => {
    const user = await User.create({
      name: "Aisha Patel",
      email: "aisha@example.com",
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

    await projectController.createProject(
      {
        body: {
          projectName: "Website Revamp",
          clientName: "Acme",
          employees: [user._id.toString()],
          interns: [],
        },
        user: { _id: user._id },
      },
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(await TaskManagement.countDocuments()).toBe(0);
  });

  it("does not auto-create tasks when assigning employees to a project", async () => {
    const user = await User.create({
      name: "Nitin Rao",
      email: "nitin@example.com",
      password: "StrongPass123",
      role: "employee",
      isApproved: true,
    });

    const project = await (require("../models/projectModel")).create({
      projectName: "CRM Migration",
      clientName: "Contoso",
      employees: [],
      interns: [],
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

    await projectController.assignEmployees(
      {
        params: { id: project._id.toString() },
        body: { employeeIds: [user._id] },
        user: { _id: user._id },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(await TaskManagement.countDocuments()).toBe(0);
  });

  it("returns assigned employees in the project listing", async () => {
    const employee = await Employee.create({
      name: "Hetvi Pandya",
      email: "hetvi@example.com",
    });
    await (require("../models/projectModel")).create({
      projectName: "Figmin",
      clientName: "Kunal",
      employees: [employee._id],
      interns: [],
    });
    const legacyUser = await User.create({
      name: "Legacy Employee",
      email: "legacy@example.com",
      password: "StrongPass123",
      role: "employee",
      isApproved: true,
    });
    await (require("../models/projectModel")).create({
      projectName: "Legacy Project",
      clientName: "Kunal",
      employees: [legacyUser._id],
      interns: [],
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

    await projectController.getAllProjects({}, res);

    expect(res.statusCode).toBe(200);
    const listedProject = res.body.data.find((project) => project.projectName === "Figmin");
    expect(listedProject.employees).toHaveLength(1);
    expect(listedProject.employees[0].name).toBe("Hetvi Pandya");
    const legacyProject = res.body.data.find((project) => project.projectName === "Legacy Project");
    expect(legacyProject.employees).toHaveLength(1);
    expect(legacyProject.employees[0].name).toBe("Legacy Employee");
  });

  it("returns employee names for newly assigned and legacy employee ids in all tasks", async () => {
    const user = await User.create({
      name: "Rahul Shah",
      email: "rahul-task@example.com",
      password: "StrongPass123",
      role: "employee",
      isApproved: true,
    });
    const employee = await Employee.create({
      name: "Rahul Shah",
      email: "rahul-task@example.com",
      userID: user._id,
      userId: user._id,
    });
    const project = await (require("../models/projectModel")).create({
      projectName: "Employee Assignment",
      clientName: "Acme",
    });

    const createRes = {
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

    await projectController.createTask(
      {
        body: {
          projectId: project._id.toString(),
          taskTitle: "New assignment",
          assignedTo: employee._id.toString(),
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        },
        user: { _id: user._id },
      },
      createRes,
    );

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.data.assignedEmployee.name).toBe("Rahul Shah");
    expect(createRes.body.data.assignedEmployee._id.toString()).toBe(user._id.toString());

    await TaskManagement.create({
      projectId: project._id,
      taskTitle: "Legacy assignment",
      assignedEmployee: employee._id,
      assignedBy: user._id,
      dueDate: new Date(Date.now() + 86400000),
    });

    const listRes = {
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
    await projectController.getAllTasks({}, listRes);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.data).toHaveLength(2);
    expect(listRes.body.data.every((task) => task.assignedEmployee?.name === "Rahul Shah")).toBe(true);
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

  it("updates the persisted task status and progress when a status changes", async () => {
    const task = await TaskManagement.create({
      projectId: new mongoose.Types.ObjectId(),
      taskTitle: "QA signoff",
      assignedEmployee: new mongoose.Types.ObjectId(),
      assignedBy: new mongoose.Types.ObjectId(),
      dueDate: new Date(Date.now() + 86400000),
      status: "pending",
      progress: 0,
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

    await taskManagementController.updateTaskStatus(
      { params: { id: task._id.toString() }, body: { status: "Completed" } },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("completed");
    expect(res.body.data.progress).toBe(100);

    const persisted = await TaskManagement.findById(task._id);
    expect(persisted.status).toBe("completed");
    expect(persisted.progress).toBe(100);
  });

  it("GET /api/task/all (taskManagementController.getAllTasks) fetches employee name for User, Employee, Team Lead, and Project fallbacks", async () => {
    const user = await User.create({
      name: "Vanshita Rathod",
      email: "hr@kevalontechnology.in",
      phoneNumber: "9876543210",
      password: "StrongPass123",
      role: "hr",
      isApproved: true,
    });

    const devUser = await User.create({
      name: "Hetvi Pandya",
      email: "hetvi@kevalontechnology.in",
      phoneNumber: "9876543211",
      password: "StrongPass123",
      role: "employee",
      isApproved: true,
    });

    const tlUser = await User.create({
      name: "Harsh Patel",
      email: "harsh@kevalontechnology.in",
      phoneNumber: "9876543212",
      password: "StrongPass123",
      role: "team lead",
      isApproved: true,
    });

    const tlEmployee = await Employee.create({
      name: "Harsh Patel",
      firstName: "Harsh",
      lastName: "Patel",
      email: "harsh@kevalontechnology.in",
      userID: tlUser._id,
      userId: tlUser._id,
    });

    const devEmployee = await Employee.create({
      name: "Pooja Sharma",
      firstName: "Pooja",
      lastName: "Sharma",
      email: "pooja@kevalontechnology.in",
    });

    const project = await (require("../models/projectModel")).create({
      projectName: "Stampy",
      clientName: "Stampy Client",
      teamLeadUser: tlUser._id,
      teamLeadEmployee: tlEmployee._id,
      employees: [devEmployee._id],
    });

    // Task 1: assignedEmployee is a User ID
    await TaskManagement.create({
      projectId: project._id,
      taskTitle: "Task with User assignee",
      assignedEmployee: devUser._id,
      assignedBy: user._id,
      dueDate: new Date(Date.now() + 86400000),
    });

    // Task 2: assignedEmployee is an Employee ID (legacy / Employee doc)
    await TaskManagement.create({
      projectId: project._id,
      taskTitle: "Task with Employee ID assignee",
      assignedEmployee: devEmployee._id,
      assignedBy: user._id,
      dueDate: new Date(Date.now() + 86400000),
    });

    // Task 3: assignedEmployee is null, but assignedTeamLeadUser and assignedTeamLeadEmployee are set (exact prompt case!)
    await TaskManagement.create({
      projectId: project._id,
      taskTitle: "Application",
      taskDescription: "APP",
      assignedEmployee: null,
      assignedIntern: null,
      assignedTeamLeadUser: tlUser._id,
      assignedTeamLeadEmployee: tlEmployee._id,
      assignedBy: user._id,
      dueDate: new Date(Date.now() + 86400000),
    });

    // Task 4: assignedEmployee is null, falls back to project employee
    await TaskManagement.create({
      projectId: project._id,
      taskTitle: "UI",
      taskDescription: "ui page",
      assignedEmployee: null,
      assignedIntern: null,
      assignedTeamLeadUser: null,
      assignedTeamLeadEmployee: null,
      assignedBy: user._id,
      dueDate: new Date(Date.now() + 86400000),
    });

    const listRes = {
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

    await taskManagementController.getAllTasks({}, listRes);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.count).toBe(4);

    const tasks = listRes.body.data;
    // Task 1 has Hetvi Pandya
    const t1 = tasks.find((t) => t.taskTitle === "Task with User assignee");
    expect(t1.assignedEmployee.name).toBe("Hetvi Pandya");
    expect(t1.employeeName).toBe("Hetvi Pandya");

    // Task 2 has Pooja Sharma
    const t2 = tasks.find((t) => t.taskTitle === "Task with Employee ID assignee");
    expect(t2.assignedEmployee.name).toBe("Pooja Sharma");
    expect(t2.employeeName).toBe("Pooja Sharma");

    // Task 3 (team lead assigned) has Harsh Patel
    const t3 = tasks.find((t) => t.taskTitle === "Application");
    expect(t3.assignedEmployee.name).toBe("Harsh Patel");
    expect(t3.assignedTeamLeadEmployee.name).toBe("Harsh Patel");
    expect(t3.assignedTeamLeadUser.name).toBe("Harsh Patel");
    expect(t3.employeeName).toBe("Harsh Patel");

    // Task 4 (project fallback) has Pooja Sharma
    const t4 = tasks.find((t) => t.taskTitle === "UI");
    expect(t4.assignedEmployee.name).toBe("Pooja Sharma");
    expect(t4.employeeName).toBe("Pooja Sharma");

    // Test getTaskById as well
    const singleRes = {
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

    await taskManagementController.getTaskById({ params: { id: t3._id.toString() } }, singleRes);
    expect(singleRes.statusCode).toBe(200);
    expect(singleRes.body.data.assignedEmployee.name).toBe("Harsh Patel");
    expect(singleRes.body.data.employeeName).toBe("Harsh Patel");
  });
});
