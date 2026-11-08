const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");
const attendanceController = require("../controllers/attendanceController");

let mongoServer;

const createMockRes = () => {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

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
  await Attendance.deleteMany({});
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Team.deleteMany({});
});

describe("GET /api/attendance/pending comprehensive behavior", () => {
  test("1. Returns approved records in data when status=approved is queried", async () => {
    const user = await User.create({
      name: "Rohan Sharma",
      email: "rohan@kevalon.com",
      phoneNumber: "9876543201",
      password: "Password123",
      role: "employee",
      uniqueID: "KT-EMP-001",
      department: "Engineering",
      isApproved: true,
    });

    // Create 4 approved records (matching user's production scenario)
    await Attendance.create([
      {
        userId: user._id,
        userType: "employee",
        date: "2026-11-01",
        checkInTime: new Date("2026-11-01T04:30:00.000Z"),
        approvalStatus: "approved",
      },
      {
        userId: user._id,
        userType: "employee",
        date: "2026-11-02",
        checkInTime: new Date("2026-11-02T04:30:00.000Z"),
        approvalStatus: "approved",
      },
      {
        userId: user._id,
        userType: "employee",
        date: "2026-11-03",
        checkInTime: new Date("2026-11-03T04:30:00.000Z"),
        approvalStatus: "approved",
      },
      {
        userId: user._id,
        userType: "employee",
        date: "2026-11-04",
        checkInTime: new Date("2026-11-04T04:30:00.000Z"),
        approvalStatus: "approved",
      },
    ]);

    // Query with status=approved
    const resApproved = createMockRes();
    await attendanceController.getPendingAttendance(
      { query: { status: "approved" } },
      resApproved
    );

    expect(resApproved.body.success).toBe(true);
    expect(resApproved.body.approvedCount).toBe(4);
    expect(resApproved.body.pendingCount).toBe(0);
    expect(resApproved.body.rejectedCount).toBe(0);
    expect(resApproved.body.count).toBe(4);
    expect(resApproved.body.data).toHaveLength(4);
    expect(resApproved.body.data[0].employeeName).toBe("Rohan Sharma");
    expect(resApproved.body.data[0].employee.uniqueID).toBe("KT-EMP-001");
    expect(resApproved.body.data[0].department).toBe("Engineering");

    // Default query without params returns count: 0, data: [] while preserving approvedCount: 4
    const resDefault = createMockRes();
    await attendanceController.getPendingAttendance({}, resDefault);
    expect(resDefault.body.success).toBe(true);
    expect(resDefault.body.approvedCount).toBe(4);
    expect(resDefault.body.pendingCount).toBe(0);
    expect(resDefault.body.count).toBe(0);
    expect(resDefault.body.data).toHaveLength(0);

    // Query with status=all returns all 4
    const resAll = createMockRes();
    await attendanceController.getPendingAttendance(
      { query: { status: "all" } },
      resAll
    );
    expect(resAll.body.count).toBe(4);
    expect(resAll.body.data).toHaveLength(4);
  });

  test("2. Correctly matches case-insensitive approvalStatus (Pending, PENDING)", async () => {
    const user = await User.create({
      name: "Priya Patel",
      email: "priya@kevalon.com",
      phoneNumber: "9876543202",
      password: "Password123",
      role: "employee",
      uniqueID: "KT-EMP-002",
      isApproved: true,
    });

    // Insert raw records directly to simulate existing MongoDB documents with legacy casing
    await Attendance.collection.insertMany([
      {
        userId: user._id,
        userType: "employee",
        date: "2026-11-05",
        checkInTime: new Date("2026-11-05T04:30:00.000Z"),
        approvalStatus: "Pending", // Title case
      },
      {
        userId: user._id,
        userType: "employee",
        date: "2026-11-06",
        checkInTime: new Date("2026-11-06T04:30:00.000Z"),
        approvalStatus: "PENDING", // Uppercase
      },
    ]);

    const res = createMockRes();
    await attendanceController.getPendingAttendance({}, res);

    expect(res.body.success).toBe(true);
    expect(res.body.pendingCount).toBe(2);
    expect(res.body.count).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].employeeName).toBe("Priya Patel");
  });

  test("3. Scopes pending attendance to team members for Team Lead callers", async () => {
    const teamLeadUser = await User.create({
      name: "Lead Vikas",
      email: "vikas@kevalon.com",
      phoneNumber: "9876543203",
      password: "Password123",
      role: "team lead",
      uniqueID: "KT-TL-001",
      isApproved: true,
    });

    const subordinateUser = await User.create({
      name: "Subordinate Amit",
      email: "amit@kevalon.com",
      phoneNumber: "9876543204",
      password: "Password123",
      role: "employee",
      uniqueID: "KT-EMP-003",
      isApproved: true,
    });

    const otherUser = await User.create({
      name: "Other Emp Sneha",
      email: "sneha@kevalon.com",
      phoneNumber: "9876543205",
      password: "Password123",
      role: "employee",
      uniqueID: "KT-EMP-004",
      isApproved: true,
    });

    const subordinateEmp = await Employee.create({
      name: "Subordinate Amit",
      email: "amit@kevalon.com",
      userID: subordinateUser._id,
      teamLeadUser: teamLeadUser._id,
      designation: "Developer",
      department: "IT",
    });

    await Team.create({
      name: "Alpha Team",
      teamLeadUser: teamLeadUser._id,
      employees: [subordinateEmp._id],
    });

    await Attendance.create([
      {
        userId: subordinateUser._id,
        userType: "employee",
        date: "2026-11-07",
        checkInTime: new Date("2026-11-07T04:30:00.000Z"),
        approvalStatus: "pending",
      },
      {
        userId: otherUser._id,
        userType: "employee",
        date: "2026-11-07",
        checkInTime: new Date("2026-11-07T04:30:00.000Z"),
        approvalStatus: "pending",
      },
    ]);

    // Team lead request
    const resTL = createMockRes();
    await attendanceController.getPendingAttendance(
      { user: { _id: teamLeadUser._id, role: "team lead" } },
      resTL
    );

    expect(resTL.body.success).toBe(true);
    expect(resTL.body.pendingCount).toBe(1);
    expect(resTL.body.data).toHaveLength(1);
    expect(resTL.body.data[0].employeeName).toBe("Subordinate Amit");

    // Admin request gets all
    const resAdmin = createMockRes();
    await attendanceController.getPendingAttendance(
      { user: { role: "admin" } },
      resAdmin
    );
    expect(resAdmin.body.pendingCount).toBe(2);
    expect(resAdmin.body.data).toHaveLength(2);
  });

  test("4. Allows Team Lead to approve their team attendance request", async () => {
    const teamLeadUser = await User.create({
      name: "Lead Vikas 2",
      email: "vikas2@kevalon.com",
      phoneNumber: "9876543206",
      password: "Password123",
      role: "team lead",
      isApproved: true,
    });

    const empUser = await User.create({
      name: "Emp Tarun",
      email: "tarun@kevalon.com",
      phoneNumber: "9876543207",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const att = await Attendance.create({
      userId: empUser._id,
      userType: "employee",
      date: "2026-11-08",
      checkInTime: new Date("2026-11-08T04:30:00.000Z"),
      approvalStatus: "pending",
    });

    const resApprove = createMockRes();
    await attendanceController.approveAttendance(
      {
        user: { _id: teamLeadUser._id, role: "team lead" },
        body: { attendanceId: att._id },
      },
      resApprove
    );

    expect(resApprove.statusCode).toBe(200);
    expect(resApprove.body.success).toBe(true);
    expect(resApprove.body.data.approvalStatus).toBe("approved");

    const updated = await Attendance.findById(att._id);
    expect(updated.approvalStatus).toBe("approved");
    expect(String(updated.approvedBy)).toBe(String(teamLeadUser._id));
  });
});
