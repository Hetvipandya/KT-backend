const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Employee = require("../models/Employee");
const Leave = require("../models/Leave");
const Team = require("../models/Team");
const Project = require("../models/projectModel");
const TeamMember = require("../models/TeamMember");

const leaveRoutes = require("../routes/leaveRoutes");

describe("Team Lead api/leave/all Employee Request Visibility", () => {
  let mongoServer;
  let app;
  const JWT_SECRET = process.env.JWT_SECRET || "kevalonTechnology";

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());
    app.use("/api/leave", leaveRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Employee.deleteMany({});
    await Leave.deleteMany({});
    await Team.deleteMany({});
    if (Project) await Project.deleteMany({});
    if (TeamMember) await TeamMember.deleteMany({});
  });

  const createToken = (user) => {
    return jwt.sign(
      {
        id: user._id.toString(),
        userId: user._id.toString(),
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
  };

  test("1. Team Lead with role 'team lead' sees leave requests of employees assigned via Employee.teamLeadUser", async () => {
    const leadUser = await User.create({
      name: "Lead One",
      email: "lead1@example.com",
      password: "Password123!",
      phoneNumber: "9876543210",
      role: "team lead",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    const leadEmployee = await Employee.create({
      userID: leadUser._id,
      firstName: "Lead",
      lastName: "One",
      email: leadUser.email,
      isTeamLead: true,
      role: "team lead",
    });

    const empUser = await User.create({
      name: "Emp Subordinate",
      email: "sub1@example.com",
      password: "Password123!",
      phoneNumber: "9876543211",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    await Employee.create({
      userID: empUser._id,
      firstName: "Emp",
      lastName: "Subordinate",
      email: empUser.email,
      teamLeadUser: leadUser._id,
      teamLeadEmployee: leadEmployee._id,
      role: "employee",
    });

    const leave = await Leave.create({
      employeeId: empUser._id,
      applicantRole: "employee",
      leaveType: "paid",
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-03"),
      totalDays: 3,
      reason: "Family function",
      status: "pending",
      teamLeadStatus: "pending",
      hrStatus: "pending",
    });

    const leadToken = createToken(leadUser);
    const res = await request(app)
      .get("/api/leave/all")
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const leaveIds = res.body.data.map((l) => l._id.toString());
    expect(leaveIds).toContain(leave._id.toString());
  });

  test("2. Team Lead whose User.role is 'employee' but Employee.isTeamLead is true sees employees' leave requests", async () => {
    // In many KT flows, user.role is 'employee' while employee.isTeamLead is true
    const leadUser = await User.create({
      name: "Promoted Lead",
      email: "lead.emp@example.com",
      password: "Password123!",
      phoneNumber: "9876543212",
      role: "employee", // user record has 'employee'
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    await Employee.create({
      userID: leadUser._id,
      firstName: "Promoted",
      lastName: "Lead",
      email: leadUser.email,
      isTeamLead: true, // Employee record marks them as Team Lead
      role: "team lead",
    });

    const empUser = await User.create({
      name: "Direct Report",
      email: "report@example.com",
      password: "Password123!",
      phoneNumber: "9876543213",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    await Employee.create({
      userID: empUser._id,
      firstName: "Direct",
      lastName: "Report",
      email: empUser.email,
      teamLeadUser: leadUser._id,
      role: "employee",
    });

    const leave = await Leave.create({
      employeeId: empUser._id,
      applicantRole: "employee",
      leaveType: "paid",
      startDate: new Date("2026-12-10"),
      endDate: new Date("2026-12-11"),
      totalDays: 2,
      reason: "Medical",
      status: "pending",
      teamLeadStatus: "pending",
      hrStatus: "pending",
    });

    const leadToken = createToken(leadUser);
    const res = await request(app)
      .get("/api/leave/all")
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const leaveIds = res.body.data.map((l) => l._id.toString());
    expect(leaveIds).toContain(leave._id.toString());
  });

  test("3. Team Lead sees leave requests of employees assigned via Team document (team.employees)", async () => {
    const leadUser = await User.create({
      name: "Team Lead Two",
      email: "lead2@example.com",
      password: "Password123!",
      phoneNumber: "9876543214",
      role: "team lead",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    const leadEmployee = await Employee.create({
      userID: leadUser._id,
      firstName: "Lead",
      lastName: "Two",
      email: leadUser.email,
      isTeamLead: true,
    });

    const empUser = await User.create({
      name: "Team Member Emp",
      email: "teammember@example.com",
      password: "Password123!",
      phoneNumber: "9876543215",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    const empDoc = await Employee.create({
      userID: empUser._id,
      firstName: "Team",
      lastName: "Member",
      email: empUser.email,
      role: "employee",
    });

    // Team has teamLead field and employee in employees array
    await Team.create({
      name: "Alpha Team",
      teamLead: leadUser._id,
      teamLeadUser: leadUser._id,
      teamLeadEmployee: leadEmployee._id,
      employees: [empDoc._id],
    });

    const leave = await Leave.create({
      employeeId: empUser._id,
      applicantRole: "employee",
      leaveType: "sick",
      startDate: new Date("2026-12-15"),
      endDate: new Date("2026-12-15"),
      totalDays: 1,
      reason: "Fever",
      status: "pending",
      teamLeadStatus: "pending",
    });

    const leadToken = createToken(leadUser);
    const res = await request(app)
      .get("/api/leave/all")
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(200);
    const leaveIds = res.body.data.map((l) => l._id.toString());
    expect(leaveIds).toContain(leave._id.toString());
  });

  test("4. Subordinate Employee where Employee.userID is unpopulated matches via email lookup", async () => {
    const leadUser = await User.create({
      name: "Lead Four",
      email: "lead4@example.com",
      password: "Password123!",
      phoneNumber: "9876543216",
      role: "team lead",
      isActive: true,
      status: "Active",
      isApproved: true,
    });

    const empUser = await User.create({
      name: "Email Linked Emp",
      email: "emaillinked@example.com",
      password: "Password123!",
      phoneNumber: "9876543217",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    // Employee document created without userID but with email and teamLeadUser
    await Employee.create({
      firstName: "Email",
      lastName: "Linked",
      email: empUser.email,
      teamLeadUser: leadUser._id,
      role: "employee",
    });

    const leave = await Leave.create({
      employeeId: empUser._id, // User._id on leave
      applicantRole: "employee",
      leaveType: "paid",
      startDate: new Date("2026-12-20"),
      endDate: new Date("2026-12-21"),
      totalDays: 2,
      reason: "Vacation",
      status: "pending",
    });

    const leadToken = createToken(leadUser);
    const res = await request(app)
      .get("/api/leave/all")
      .set("Authorization", `Bearer ${leadToken}`);

    expect(res.status).toBe(200);
    const leaveIds = res.body.data.map((l) => l._id.toString());
    expect(leaveIds).toContain(leave._id.toString());
  });

  test("5. Team Lead with role 'team lead' sees subordinate leaves, and response contains both data and leaves", async () => {
    const leadUser = await User.create({
      name: "TL Variant",
      email: "tlvariant@example.com",
      password: "Password123!",
      phoneNumber: "9876543220",
      role: "team lead",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    const leadEmp = await Employee.create({
      userID: leadUser._id,
      firstName: "TL",
      lastName: "Variant",
      email: leadUser.email,
      isTeamLead: true,
      role: "team lead",
    });

    const empUser = await User.create({
      name: "Under TL",
      email: "undertl@example.com",
      password: "Password123!",
      phoneNumber: "9876543221",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    await Employee.create({
      userID: empUser._id,
      firstName: "Under",
      lastName: "TL",
      email: empUser.email,
      teamLeadEmployee: leadEmp._id,
      role: "employee",
    });

    const leave = await Leave.create({
      employeeId: empUser._id,
      applicantRole: "employee",
      leaveType: "paid",
      startDate: new Date("2026-12-25"),
      endDate: new Date("2026-12-26"),
      totalDays: 2,
      reason: "Holiday",
      status: "pending",
    });

    const token = createToken(leadUser);
    const res = await request(app)
      .get("/api/leave/all")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(Array.isArray(res.body.leaves)).toBe(true);
    const ids = res.body.data.map((l) => l._id.toString());
    expect(ids).toContain(leave._id.toString());
  });

  test("6. Team Lead querying with ?status=approved filters out pending leaves", async () => {
    const leadUser = await User.create({
      name: "Filter Lead",
      email: "filterlead@example.com",
      password: "Password123!",
      phoneNumber: "9876543222",
      role: "team lead",
      isActive: true,
      status: "Active",
      isApproved: true,
    });

    const empUser = await User.create({
      name: "Filter Emp",
      email: "filteremp@example.com",
      password: "Password123!",
      phoneNumber: "9876543223",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    await Employee.create({
      userID: empUser._id,
      firstName: "Filter",
      lastName: "Emp",
      email: empUser.email,
      teamLeadUser: leadUser._id,
      role: "employee",
    });

    const pendingLeave = await Leave.create({
      employeeId: empUser._id,
      applicantRole: "employee",
      leaveType: "paid",
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-01"),
      totalDays: 1,
      reason: "Pending",
      status: "pending",
    });

    const approvedLeave = await Leave.create({
      employeeId: empUser._id,
      applicantRole: "employee",
      leaveType: "paid",
      startDate: new Date("2026-12-05"),
      endDate: new Date("2026-12-05"),
      totalDays: 1,
      reason: "Approved",
      status: "approved",
    });

    const token = createToken(leadUser);
    const res = await request(app)
      .get("/api/leave/all?status=approved")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((l) => l._id.toString());
    expect(ids).toContain(approvedLeave._id.toString());
    expect(ids).not.toContain(pendingLeave._id.toString());
  });

  test("7. Regular employee only sees their own leaves and not others", async () => {
    const emp1User = await User.create({
      name: "Emp One",
      email: "emp1@example.com",
      password: "Password123!",
      phoneNumber: "9876543224",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });

    const emp2User = await User.create({
      name: "Emp Two",
      email: "emp2@example.com",
      password: "Password123!",
      phoneNumber: "9876543225",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });

    const leave1 = await Leave.create({
      employeeId: emp1User._id,
      applicantRole: "employee",
      leaveType: "paid",
      startDate: new Date("2026-12-10"),
      endDate: new Date("2026-12-10"),
      totalDays: 1,
      reason: "Emp1",
      status: "pending",
    });

    const leave2 = await Leave.create({
      employeeId: emp2User._id,
      applicantRole: "employee",
      leaveType: "paid",
      startDate: new Date("2026-12-10"),
      endDate: new Date("2026-12-10"),
      totalDays: 1,
      reason: "Emp2",
      status: "pending",
    });

    const token = createToken(emp1User);
    const res = await request(app)
      .get("/api/leave/all")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((l) => l._id.toString());
    expect(ids).toContain(leave1._id.toString());
    expect(ids).not.toContain(leave2._id.toString());
  });

  test("8. Team Lead whose User.role is 'employee' can APPROVE employee leave via PUT /api/leave/teamlead-approval", async () => {
    const leadUser = await User.create({
      name: "Approver Lead",
      email: "approver.lead@example.com",
      password: "Password123!",
      phoneNumber: "9876543230",
      role: "employee", // User.role is employee
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    await Employee.create({
      userID: leadUser._id,
      firstName: "Approver",
      lastName: "Lead",
      email: leadUser.email,
      isTeamLead: true, // Employee is Team Lead
      role: "team lead",
    });

    const empUser = await User.create({
      name: "Subordinate To Approve",
      email: "sub.approve@example.com",
      password: "Password123!",
      phoneNumber: "9876543231",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    await Employee.create({
      userID: empUser._id,
      firstName: "Subordinate",
      lastName: "Approve",
      email: empUser.email,
      teamLeadUser: leadUser._id,
      role: "employee",
    });

    const leave = await Leave.create({
      employeeId: empUser._id,
      applicantRole: "employee",
      leaveType: "paid",
      startDate: new Date("2026-12-15"),
      endDate: new Date("2026-12-16"),
      totalDays: 2,
      reason: "Vacation",
      status: "pending",
      teamLeadStatus: "pending",
      hrStatus: "pending",
    });

    const leadToken = createToken(leadUser);
    const res = await request(app)
      .put("/api/leave/teamlead-approval")
      .set("Authorization", `Bearer ${leadToken}`)
      .send({
        leaveId: leave._id.toString(),
        status: "approved",
        remark: "Approved, good work",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updatedLeave = await Leave.findById(leave._id);
    expect(updatedLeave.teamLeadStatus).toBe("approved");
    expect(updatedLeave.status).toBe("pending_hr");
    expect(updatedLeave.hrStatus).toBe("pending");
  });

  test("9. Team Lead can call PUT /api/leave/teamlead/approve directly", async () => {
    const leadUser = await User.create({
      name: "Direct Approve Lead",
      email: "direct.lead@example.com",
      password: "Password123!",
      phoneNumber: "9876543232",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    await Employee.create({
      userID: leadUser._id,
      firstName: "Direct",
      lastName: "Lead",
      email: leadUser.email,
      isTeamLead: true,
      role: "team lead",
    });

    const empUser = await User.create({
      name: "Emp Direct",
      email: "emp.direct@example.com",
      password: "Password123!",
      phoneNumber: "9876543233",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });

    const leave = await Leave.create({
      employeeId: empUser._id,
      applicantRole: "employee",
      leaveType: "paid",
      startDate: new Date("2026-12-18"),
      endDate: new Date("2026-12-18"),
      totalDays: 1,
      reason: "Personal",
      status: "pending",
      teamLeadStatus: "pending",
    });

    const leadToken = createToken(leadUser);
    const res = await request(app)
      .put("/api/leave/teamlead/approve")
      .set("Authorization", `Bearer ${leadToken}`)
      .send({
        leaveId: leave._id.toString(),
        remark: "Looks good",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updatedLeave = await Leave.findById(leave._id);
    expect(updatedLeave.teamLeadStatus).toBe("approved");
    expect(updatedLeave.status).toBe("pending_hr");
  });

  test("10. Regular employee cannot access teamlead-approval (gets 403)", async () => {
    const regularEmpUser = await User.create({
      name: "Just Employee",
      email: "just.emp@example.com",
      password: "Password123!",
      phoneNumber: "9876543234",
      role: "employee",
      isActive: true,
      status: "Active",
      isApproved: true,
    });
    await Employee.create({
      userID: regularEmpUser._id,
      firstName: "Just",
      lastName: "Employee",
      email: regularEmpUser.email,
      isTeamLead: false,
      role: "employee",
    });

    const regularToken = createToken(regularEmpUser);
    const res = await request(app)
      .put("/api/leave/teamlead-approval")
      .set("Authorization", `Bearer ${regularToken}`)
      .send({
        leaveId: new mongoose.Types.ObjectId().toString(),
        status: "approved",
        remark: "Unauthorized try",
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('is not authorized to access this resource');
  });
});
