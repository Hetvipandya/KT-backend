const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../models/User");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const Branch = require("../models/Branch");
const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const leaveRoutes = require("../routes/leaveRoutes");

// Mock notifications to prevent external networking
jest.mock("../utils/sendNotification", () => ({
  notify: jest.fn().mockResolvedValue(undefined),
}));

describe("Admin & HR Leave Creation on Behalf of Employee Test Suite", () => {
  let mongoServer;
  let app;
  let companyId;
  let branchId;
  let adminUser;
  let hrUser;
  let superAdminUser;
  let employeeUser1;
  let employeeUser2;
  let employeeDoc1;
  let employeeDoc2;

  let currentAuthUser;

  beforeAll(async () => {
    jest.setTimeout(25000);
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    companyId = new mongoose.Types.ObjectId();
    branchId = new mongoose.Types.ObjectId();

    await Company.create({
      _id: companyId,
      name: "Kevalon Technology",
      companyName: "Kevalon Technology Pvt Ltd",
    });

    await Branch.create({
      _id: branchId,
      companyId,
      branchName: "Ahmedabad HQ",
    });

    // 1. Admin
    adminUser = await User.create({
      name: "Admin Tester",
      email: "admin.leave@kevalon.com",
      phoneNumber: "9811100001",
      password: "password123",
      role: "admin",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    // 2. HR
    hrUser = await User.create({
      name: "HR Manager",
      email: "hr.leave@kevalon.com",
      phoneNumber: "9811100002",
      password: "password123",
      role: "hr",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    // 3. Superadmin
    superAdminUser = await User.create({
      name: "Super Admin",
      email: "superadmin.leave@kevalon.com",
      phoneNumber: "9811100003",
      password: "password123",
      role: "superadmin",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    // 4. Employee 1
    employeeUser1 = await User.create({
      name: "Rohan Employee",
      email: "rohan.leave@kevalon.com",
      phoneNumber: "9811100004",
      password: "password123",
      role: "employee",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    employeeDoc1 = await Employee.create({
      userID: employeeUser1._id,
      employeeID: "EMP-001",
      email: employeeUser1.email,
      companyId,
      branchId,
      designation: "Developer",
      joiningDate: new Date("2026-01-01"),
    });

    // 5. Employee 2
    employeeUser2 = await User.create({
      name: "Pooja Employee",
      email: "pooja.leave@kevalon.com",
      phoneNumber: "9811100005",
      password: "password123",
      role: "employee",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    employeeDoc2 = await Employee.create({
      userID: employeeUser2._id,
      employeeID: "EMP-002",
      email: employeeUser2.email,
      companyId,
      branchId,
      designation: "Designer",
      joiningDate: new Date("2026-01-01"),
    });

    // Setup Express App
    app = express();
    app.use(express.json());

    // Role-switching auth middleware mock
    app.use((req, res, next) => {
      req.user = currentAuthUser || adminUser;
      next();
    });

    app.use("/api/leave", leaveRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    currentAuthUser = adminUser;
    await Leave.deleteMany({});
    await LeaveBalance.deleteMany({});
  });

  describe("1. Admin Applying Leave on Behalf of Employee", () => {
    test("Admin can apply leave for employee using employeeId (Employee ObjectId)", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .post("/api/leave/apply")
        .send({
          employeeId: employeeDoc1._id.toString(),
          leaveType: "full_day",
          startDate: "2026-11-15",
          endDate: "2026-11-15",
          reason: "Medical appointment arranged by admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const leaveEmpId = (res.body.data.employeeId?._id || res.body.data.employeeId).toString();
      expect(leaveEmpId).toBe(employeeUser1._id.toString());
      expect(res.body.data.status).toBe("approved");
      expect(res.body.data.leaveType).toBe("full_day");
      expect(res.body.data.isHalfDay).toBe(false);
      expect(res.body.data.halfDayType).toBeNull();
    });

    test.each([
      {
        actor: "admin",
        halfDayType: "first-half",
        leaveType: "half_day_1",
        status: "pending",
        expectedStatus: "pending_hr",
      },
      {
        actor: "hr",
        halfDayType: "second_half",
        leaveType: "half_day_2",
        status: "approved",
        expectedStatus: "approved",
      },
    ])(
      "$actor creates a normalized $halfDayType request with $expectedStatus status",
      async ({ actor, halfDayType, leaveType, status, expectedStatus }) => {
        currentAuthUser = actor === "admin" ? adminUser : hrUser;

        const res = await request(app)
          .post("/api/leave/apply")
          .send({
            employeeId: employeeDoc1._id.toString(),
            leaveType: "full_day",
            isHalfDay: true,
            halfDayType,
            startDate: "2026-11-23",
            endDate: "2026-11-23",
            status,
            reason: "Half-day normalization regression",
          });

        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({
          leaveType,
          isHalfDay: true,
          halfDayType: leaveType === "half_day_1" ? "first-half" : "second-half",
          totalDays: 0.5,
          status: expectedStatus,
        });
      },
    );

    test("Admin can apply leave for employee using string employeeID (e.g. EMP-002)", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .post("/api/leave/apply")
        .send({
          employeeId: "EMP-002",
          leaveType: "full_day",
          startDate: "2026-11-16",
          endDate: "2026-11-16",
          reason: "Personal work granted by admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const leaveEmpId = (res.body.data.employeeId?._id || res.body.data.employeeId).toString();
      expect(leaveEmpId).toBe(employeeUser2._id.toString());
    });

    test("Admin can create leave using POST /api/leave/create alias", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .post("/api/leave/create")
        .send({
          userId: employeeUser1._id.toString(),
          leaveType: "full_day",
          startDate: "2026-11-17",
          endDate: "2026-11-17",
          reason: "Official leave by Admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const leaveEmpId = (res.body.data.employeeId?._id || res.body.data.employeeId).toString();
      expect(leaveEmpId).toBe(employeeUser1._id.toString());
    });
  });

  describe("2. HR Applying Leave on Behalf of Employee", () => {
    test("HR can apply leave for employee without getting 403 'You cannot apply for leave for another employee'", async () => {
      currentAuthUser = hrUser;

      const res = await request(app)
        .post("/api/leave/apply")
        .send({
          employeeId: employeeDoc1._id.toString(),
          leaveType: "full_day",
          startDate: "2026-11-18",
          endDate: "2026-11-18",
          reason: "Family function granted by HR",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const leaveEmpId = (res.body.data.employeeId?._id || res.body.data.employeeId).toString();
      expect(leaveEmpId).toBe(employeeUser1._id.toString());
    });

    test("HR can create approved leave directly when status: 'approved' is provided", async () => {
      currentAuthUser = hrUser;

      const res = await request(app)
        .post("/api/leave/apply")
        .send({
          employeeId: employeeDoc2._id.toString(),
          leaveType: "full_day",
          startDate: "2026-11-19",
          endDate: "2026-11-19",
          reason: "Emergency leave approved by HR",
          status: "approved",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("approved");
    });
  });

  describe("3. Superadmin Applying Leave on Behalf of Employee", () => {
    test("Superadmin can apply leave for employee", async () => {
      currentAuthUser = superAdminUser;

      const res = await request(app)
        .post("/api/leave/apply")
        .send({
          userId: employeeUser1._id.toString(),
          leaveType: "full_day",
          startDate: "2026-11-20",
          endDate: "2026-11-20",
          reason: "Granted by Super Admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const leaveEmpId = (res.body.data.employeeId?._id || res.body.data.employeeId).toString();
      expect(leaveEmpId).toBe(employeeUser1._id.toString());
    });
  });

  describe("4. Security: Regular Employees Cannot Apply for Another Employee", () => {
    test("Employee 1 attempting to apply leave for Employee 2 receives 403 'You cannot apply for leave for another employee'", async () => {
      currentAuthUser = employeeUser1;

      const res = await request(app)
        .post("/api/leave/apply")
        .send({
          employeeId: employeeUser2._id.toString(),
          leaveType: "full_day",
          startDate: "2026-11-25",
          endDate: "2026-11-25",
          reason: "Sneaky leave request",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("You cannot apply for leave for another employee");
    });

    test("Employee 1 can apply leave for themselves successfully", async () => {
      currentAuthUser = employeeUser1;

      const res = await request(app)
        .post("/api/leave/apply")
        .send({
          leaveType: "full_day",
          startDate: "2026-11-26",
          endDate: "2026-11-26",
          reason: "Personal leave application",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const leaveEmpId = (res.body.data.employeeId?._id || res.body.data.employeeId).toString();
      expect(leaveEmpId).toBe(employeeUser1._id.toString());
    });
  });
});
