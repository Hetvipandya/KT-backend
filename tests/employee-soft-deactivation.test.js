const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../models/User");
const Employee = require("../models/Employee");
const Company = require("../models/Company");
const Attendance = require("../models/Attendance");
const MonthlySalary = require("../models/MonthlySalary");
const Leave = require("../models/Leave");
const EmployeeDeduction = require("../models/EmployeeDeduction");
const EmployeeDocument = require("../models/EmployeeDocument");
const EmployeeHistory = require("../models/EmployeeHistory");
const AuditLog = require("../models/AuditLog");

const employeeRoutes = require("../routes/employee.routes");
const authController = require("../controllers/auth.controller");
const userControllers = require("../controllers/userControllers");

jest.mock("../utils/sendNotification", () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

describe("Employee Soft-Deactivation with Related-Data Retention", () => {
  let mongoServer;
  let app;
  let companyId;
  let adminUser;
  let hrUser;
  let superAdminUser;
  let regularEmployeeUser;
  let teamLeadUser;
  let accountantUser;

  let currentAuthUser;

  const createAuthToken = (user) => {
    return jwt.sign(
      { id: user._id, userId: user._id, role: user.role },
      process.env.JWT_SECRET || "kevalonTechnology",
      { expiresIn: "1h" }
    );
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    companyId = new mongoose.Types.ObjectId();

    await Company.create({
      _id: companyId,
      name: "Kevalon Technologies",
      companyName: "Kevalon Technologies",
      email: "hr@kevalon.com",
    });

    superAdminUser = await User.create({
      name: "Super Admin",
      email: "superadmin@kevalon.com",
      phoneNumber: "9876500001",
      password: "Password123!",
      role: "super admin",
      isApproved: true,
      isActive: true,
      companyId,
    });

    adminUser = await User.create({
      name: "Admin User",
      email: "admin@kevalon.com",
      phoneNumber: "9876500002",
      password: "Password123!",
      role: "admin",
      isApproved: true,
      isActive: true,
      companyId,
    });

    hrUser = await User.create({
      name: "HR Manager",
      email: "hr@kevalon.com",
      phoneNumber: "9876500003",
      password: "Password123!",
      role: "hr",
      isApproved: true,
      isActive: true,
      companyId,
    });

    regularEmployeeUser = await User.create({
      name: "Normal Employee",
      email: "norm.emp@kevalon.com",
      phoneNumber: "9876500004",
      password: "Password123!",
      role: "employee",
      isApproved: true,
      isActive: true,
      companyId,
    });

    teamLeadUser = await User.create({
      name: "Team Lead",
      email: "tl@kevalon.com",
      phoneNumber: "9876500005",
      password: "Password123!",
      role: "team lead",
      isApproved: true,
      isActive: true,
      companyId,
    });

    accountantUser = await User.create({
      name: "Accountant",
      email: "acc@kevalon.com",
      phoneNumber: "9876500006",
      password: "Password123!",
      role: "accountant",
      isApproved: true,
      isActive: true,
      companyId,
    });

    app = express();
    app.use(express.json());

    // Login routes
    app.post("/api/auth/login", authController.login);
    app.post("/api/users/login", userControllers.loginUser);

    // Auth middleware for testing /api/employee routes
    app.use((req, res, next) => {
      // If an Authorization Bearer header is passed, let real auth middleware handle it if set,
      // or map from currentAuthUser
      if (req.headers.authorization) {
        return next();
      }
      if (currentAuthUser === null) {
        req.user = undefined;
      } else {
        req.user = currentAuthUser || adminUser;
      }
      next();
    });

    const { protect } = require("../middleware/authMiddleware");
    const authenticate = require("../middleware/authenticate");

    app.get("/test/protect-check", protect, (req, res) => res.json({ success: true, user: req.user }));
    app.get("/test/authenticate-check", authenticate, (req, res) => res.json({ success: true, user: req.user }));

    app.use("/api/employee", employeeRoutes);
    app.use("/api/employees", employeeRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    currentAuthUser = adminUser;
  });

  let phoneCounter = 10000;
  // Helper to create a test employee with linked user and historical related records
  const setupTestEmployeeWithRelatedData = async (identifier = "EMP101") => {
    const employeeUserId = new mongoose.Types.ObjectId();
    const employeeDocId = new mongoose.Types.ObjectId();

    const empUser = await User.create({
      _id: employeeUserId,
      name: `Test Employee ${identifier}`,
      email: `emp.${identifier.toLowerCase()}@kevalon.com`,
      phoneNumber: `98765${++phoneCounter}`,
      password: "Password123!",
      role: "employee",
      isApproved: true,
      isActive: true,
      uniqueID: identifier,
      companyId,
    });

    const employee = await Employee.create({
      _id: employeeDocId,
      companyId,
      employeeID: identifier,
      employeeCode: identifier,
      firstName: "Test",
      lastName: identifier,
      name: `Test ${identifier}`,
      email: empUser.email,
      userID: employeeUserId,
      userId: employeeUserId,
      employeeStatus: "Active",
      status: "ACTIVE",
      role: "employee",
      designation: "Software Engineer",
      department: "Engineering",
    });

    // 1. Attendance record
    const attendance = await Attendance.create({
      employeeId: employee._id,
      userId: empUser._id,
      userType: "employee",
      date: "2026-11-01",
      status: "present",
      companyId,
    });

    // 2. Monthly Salary / Payroll record
    const monthlySalary = await MonthlySalary.create({
      employeeId: employee._id,
      userId: empUser._id,
      month: 11,
      year: 2026,
      salary: 50000,
      netSalary: 48000,
      grossSalary: 52000,
      status: "approved",
      companyId,
    });

    // 3. Leave record
    const leave = await Leave.create({
      employeeId: empUser._id,
      applicantRole: "employee",
      leaveType: "paid",
      startDate: new Date("2026-11-10"),
      endDate: new Date("2026-11-11"),
      totalDays: 1,
      reason: "Vacation",
      status: "approved",
      companyId,
    });

    // 4. Employee Deduction record
    const deduction = await EmployeeDeduction.create({
      deductionRecordId: `DED-${identifier}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      employeeId: employee._id,
      userId: empUser._id,
      teamLeadId: teamLeadUser._id,
      deductionMasterId: new mongoose.Types.ObjectId(),
      month: 11,
      year: 2026,
      amount: 2000,
      status: "Approved",
      isLegallyPermissible: true,
      companyId,
    });

    // 5. Employee Document
    const document = await EmployeeDocument.create({
      employeeID: employee._id,
      aadharCard: "https://kevalon.com/docs/aadhar.pdf",
      panCard: "https://kevalon.com/docs/pan.pdf",
    });

    // 6. Employee History
    await EmployeeHistory.create({
      employeeID: employee._id,
      action: "created",
      message: "Employee onboarded successfully",
      actionBy: adminUser._id,
    });

    return {
      empUser,
      employee,
      attendance,
      monthlySalary,
      leave,
      deduction,
      document,
    };
  };

  // =========================================================================
  // 1. DEACTIVATION BLOCKS EMPLOYEE LOGIN & ACCESS
  // =========================================================================
  describe("1. Deactivation blocks employee login and API access", () => {
    it("1.1 Deactivating an employee marks account inactive and blocks login on /api/auth/login", async () => {
      const { empUser, employee } = await setupTestEmployeeWithRelatedData("EMP001");

      // Verify active employee can log in before deactivation
      const loginBefore = await request(app)
        .post("/api/auth/login")
        .send({ email: empUser.email, password: "Password123!" });
      expect(loginBefore.status).toBe(200);
      expect(loginBefore.body.success).toBe(true);

      // Admin deactivates employee via POST /api/employee/:id/deactivate
      const deactivateRes = await request(app)
        .post(`/api/employee/${employee._id}/deactivate`)
        .send({ reason: "Sabbatical leave" });

      expect(deactivateRes.status).toBe(200);
      expect(deactivateRes.body.success).toBe(true);
      expect(deactivateRes.body.data.isDeactivated).toBe(true);
      expect(deactivateRes.body.data.employeeStatus).toBe("Inactive");
      expect(deactivateRes.body.data.status).toBe("INACTIVE");

      // Verify Employee document in DB
      const updatedEmp = await Employee.findById(employee._id);
      expect(updatedEmp.isDeactivated).toBe(true);
      expect(updatedEmp.employeeStatus).toBe("Inactive");
      expect(updatedEmp.status).toBe("INACTIVE");

      // Verify User document in DB
      const updatedUser = await User.findById(empUser._id);
      expect(updatedUser.isActive).toBe(false);
      expect(updatedUser.status).toBe("Inactive");
      expect(updatedUser.isDeactivated).toBe(true);

      // Verify /api/auth/login is now BLOCKED with 403
      const loginAfter = await request(app)
        .post("/api/auth/login")
        .send({ email: empUser.email, password: "Password123!" });

      expect(loginAfter.status).toBe(403);
      expect(loginAfter.body.success).toBe(false);
      expect(loginAfter.body.message).toBe("Your account is inactive");
    });

    it("1.2 Deactivated employee login is blocked on /api/users/login", async () => {
      const { empUser, employee } = await setupTestEmployeeWithRelatedData("EMP002");

      // Deactivate
      await request(app).post(`/api/employee/${employee._id}/deactivate`);

      // Verify /api/users/login is blocked with 403
      const loginRes = await request(app)
        .post("/api/users/login")
        .send({ email: empUser.email, password: "Password123!" });

      expect(loginRes.status).toBe(403);
      expect(loginRes.body.success).toBe(false);
      expect(loginRes.body.message).toBe("Your account is inactive");
    });

    it("1.3 Active Bearer token of deactivated employee is blocked from protected APIs", async () => {
      const { empUser, employee } = await setupTestEmployeeWithRelatedData("EMP003");
      const employeeToken = createAuthToken(empUser);

      // Verify token works before deactivation
      const beforeProtect = await request(app)
        .get("/test/protect-check")
        .set("Authorization", `Bearer ${employeeToken}`);
      expect(beforeProtect.status).toBe(200);

      const beforeAuthenticate = await request(app)
        .get("/test/authenticate-check")
        .set("Authorization", `Bearer ${employeeToken}`);
      expect(beforeAuthenticate.status).toBe(200);

      // Deactivate employee
      await request(app).post(`/api/employee/${employee._id}/deactivate`);

      // Attempt protected calls using the deactivated employee's token
      const afterProtect = await request(app)
        .get("/test/protect-check")
        .set("Authorization", `Bearer ${employeeToken}`);
      expect(afterProtect.status).toBe(403);
      expect(afterProtect.body.message).toBe("User account disabled");

      const afterAuthenticate = await request(app)
        .get("/test/authenticate-check")
        .set("Authorization", `Bearer ${employeeToken}`);
      expect(afterAuthenticate.status).toBe(403);
      expect(afterAuthenticate.body.message).toContain("Account is disabled or deactivated");
    });
  });

  // =========================================================================
  // 2. RELATED-DATA RETENTION
  // =========================================================================
  describe("2. Existing related records remain unchanged and retrievable", () => {
    it("2.1 Retains attendance, salary, leave, deduction, documents, and history without deletion", async () => {
      const {
        empUser,
        employee,
        attendance,
        monthlySalary,
        leave,
        deduction,
        document,
      } = await setupTestEmployeeWithRelatedData("EMP004");

      // Deactivate employee
      const res = await request(app).put(`/api/employee/${employee._id}/deactivate`);
      expect(res.status).toBe(200);

      // 1. Verify Attendance still exists and references the employee
      const savedAttendance = await Attendance.findById(attendance._id);
      expect(savedAttendance).not.toBeNull();
      expect(savedAttendance.userId.toString()).toBe(empUser._id.toString());

      // 2. Verify MonthlySalary still exists and references the employee
      const savedSalary = await MonthlySalary.findById(monthlySalary._id);
      expect(savedSalary).not.toBeNull();
      expect(savedSalary.employeeId.toString()).toBe(employee._id.toString());
      expect(savedSalary.netSalary).toBe(48000);

      // 3. Verify Leave still exists and references the employee
      const savedLeave = await Leave.findById(leave._id);
      expect(savedLeave).not.toBeNull();
      expect(savedLeave.employeeId.toString()).toBe(empUser._id.toString());

      // 4. Verify Deduction still exists and references the employee
      const savedDeduction = await EmployeeDeduction.findById(deduction._id);
      expect(savedDeduction).not.toBeNull();
      expect(savedDeduction.employeeId.toString()).toBe(employee._id.toString());

      // 5. Verify EmployeeDocument still exists
      const savedDoc = await EmployeeDocument.findById(document._id);
      expect(savedDoc).not.toBeNull();
      expect(savedDoc.aadharCard).toBe("https://kevalon.com/docs/aadhar.pdf");

      // 6. Verify EmployeeHistory has new deactivated event and retained onboarding history
      const history = await EmployeeHistory.find({ employeeID: employee._id }).sort({ createdAt: -1 });
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].action).toBe("deactivated");

      // 7. Verify AuditLog collection recorded the deactivation event
      const auditEntry = await AuditLog.findOne({
        entityId: employee._id.toString(),
        action: "DEACTIVATE",
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry.actorName).toBe(adminUser.name);
      expect(auditEntry.actorRole).toBe(adminUser.role);
    });

    it("2.2 Authorized admin can still retrieve the deactivated employee's profile and documents", async () => {
      const { employee } = await setupTestEmployeeWithRelatedData("EMP005");
      await request(app).post(`/api/employee/${employee._id}/deactivate`);

      // Admin fetches profile
      const profileRes = await request(app).get(`/api/employee/profile/${employee._id}`);
      expect(profileRes.status).toBe(200);
      expect(profileRes.body.success).toBe(true);
      expect(profileRes.body.employee.isDeactivated).toBe(true);
      expect(profileRes.body.employee.employeeStatus).toBe("Inactive");
      expect(profileRes.body.documents).not.toBeNull();
      expect(profileRes.body.history.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // 3. AUTHORIZATION & VALIDATION ENFORCEMENT
  // =========================================================================
  describe("3. Authorization and validation enforcement on deactivation and reactivation", () => {
    it("3.1 Unauthenticated requests are blocked with 401", async () => {
      const { employee } = await setupTestEmployeeWithRelatedData("EMP006");
      currentAuthUser = null; // simulate no user authenticated

      const resDeact = await request(app).post(`/api/employee/${employee._id}/deactivate`);
      expect(resDeact.status).toBe(401);
      expect(resDeact.body.success).toBe(false);

      const resReact = await request(app).post(`/api/employee/${employee._id}/reactivate`);
      expect(resReact.status).toBe(401);
      expect(resReact.body.success).toBe(false);
    });

    it("3.2 Regular employee, team lead, and accountant cannot deactivate or reactivate (403)", async () => {
      const { employee } = await setupTestEmployeeWithRelatedData("EMP007");

      for (const unauthorizedUser of [regularEmployeeUser, teamLeadUser, accountantUser]) {
        currentAuthUser = unauthorizedUser;

        const deactRes = await request(app).post(`/api/employee/${employee._id}/deactivate`);
        expect(deactRes.status).toBe(403);
        expect(deactRes.body.success).toBe(false);

        const reactRes = await request(app).post(`/api/employee/${employee._id}/reactivate`);
        expect(reactRes.status).toBe(403);
        expect(reactRes.body.success).toBe(false);
      }
    });

    it("3.3 Admin and HR can successfully deactivate employees", async () => {
      const { employee: empA } = await setupTestEmployeeWithRelatedData("EMP008A");
      const { employee: empB } = await setupTestEmployeeWithRelatedData("EMP008B");

      // Admin deactivates empA
      currentAuthUser = adminUser;
      const resAdmin = await request(app).post(`/api/employee/${empA._id}/deactivate`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.data.isDeactivated).toBe(true);

      // HR deactivates empB
      currentAuthUser = hrUser;
      const resHr = await request(app).post(`/api/employee/${empB._id}/deactivate`);
      expect(resHr.status).toBe(200);
      expect(resHr.body.data.isDeactivated).toBe(true);
    });

    it("3.4 Administrators cannot deactivate their own account (400)", async () => {
      // Create admin employee linked to adminUser
      const adminEmployee = await Employee.create({
        companyId,
        employeeID: "ADMIN-EMP",
        firstName: "Admin",
        lastName: "Self",
        email: adminUser.email,
        userID: adminUser._id,
        employeeStatus: "Active",
        status: "ACTIVE",
        role: "admin",
      });

      currentAuthUser = adminUser;
      const selfDeactRes = await request(app).post(`/api/employee/${adminEmployee._id}/deactivate`);
      expect(selfDeactRes.status).toBe(400);
      expect(selfDeactRes.body.success).toBe(false);
      expect(selfDeactRes.body.message).toContain("cannot deactivate their own account");
    });

    it("3.5 Returns 404 for non-existent employee", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app).post(`/api/employee/${nonExistentId}/deactivate`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Employee not found");
    });

    it("3.6 Prevents redundant deactivation of already inactive employee (400)", async () => {
      const { employee } = await setupTestEmployeeWithRelatedData("EMP009");
      await request(app).post(`/api/employee/${employee._id}/deactivate`);

      // Second deactivation call
      const secondDeact = await request(app).post(`/api/employee/${employee._id}/deactivate`);
      expect(secondDeact.status).toBe(400);
      expect(secondDeact.body.success).toBe(false);
      expect(secondDeact.body.message).toBe("Employee is already inactive/deactivated");
    });
  });

  // =========================================================================
  // 4. REACTIVATION WORKFLOW & NO DUPLICATION
  // =========================================================================
  describe("4. Reactivation restores active access without duplicating records", () => {
    it("4.1 Reactivating employee restores active state and allows login again", async () => {
      const { empUser, employee } = await setupTestEmployeeWithRelatedData("EMP010");

      // 1. Deactivate
      await request(app).post(`/api/employee/${employee._id}/deactivate`);

      // 2. Reactivate via POST /api/employee/:id/reactivate
      const reactivateRes = await request(app).post(`/api/employee/${employee._id}/reactivate`);
      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.success).toBe(true);
      expect(reactivateRes.body.data.isDeactivated).toBe(false);
      expect(reactivateRes.body.data.employeeStatus).toBe("Active");
      expect(reactivateRes.body.data.status).toBe("ACTIVE");

      // Verify DB state
      const empInDb = await Employee.findById(employee._id);
      expect(empInDb.isDeactivated).toBe(false);
      expect(empInDb.employeeStatus).toBe("Active");
      expect(empInDb.status).toBe("ACTIVE");

      const userInDb = await User.findById(empUser._id);
      expect(userInDb.isActive).toBe(true);
      expect(userInDb.isDeactivated).toBe(false);
      expect(userInDb.status).toBe("Active");

      // 3. Verify employee can log in again on /api/auth/login and /api/users/login
      const loginAuthRes = await request(app)
        .post("/api/auth/login")
        .send({ email: empUser.email, password: "Password123!" });
      expect(loginAuthRes.status).toBe(200);
      expect(loginAuthRes.body.success).toBe(true);

      const loginUsersRes = await request(app)
        .post("/api/users/login")
        .send({ email: empUser.email, password: "Password123!" });
      expect(loginUsersRes.status).toBe(200);
      expect(loginUsersRes.body.success).toBe(true);
    });

    it("4.2 Reactivation does not recreate or duplicate User or Employee documents", async () => {
      const { empUser, employee } = await setupTestEmployeeWithRelatedData("EMP011");

      const initialUserCount = await User.countDocuments({ email: empUser.email });
      const initialEmpCount = await Employee.countDocuments({ email: empUser.email });
      expect(initialUserCount).toBe(1);
      expect(initialEmpCount).toBe(1);

      // Deactivate then reactivate
      await request(app).post(`/api/employee/${employee._id}/deactivate`);
      await request(app).post(`/api/employee/${employee._id}/reactivate`);

      const finalUserCount = await User.countDocuments({ email: empUser.email });
      const finalEmpCount = await Employee.countDocuments({ email: empUser.email });
      expect(finalUserCount).toBe(1);
      expect(finalEmpCount).toBe(1);
    });

    it("4.3 Cannot reactivate an already active employee (400)", async () => {
      const { employee } = await setupTestEmployeeWithRelatedData("EMP012");
      const res = await request(app).post(`/api/employee/${employee._id}/reactivate`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Employee is already active");
    });
  });

  // =========================================================================
  // 5. LIST AND DETAIL APIS ACTIVE / INACTIVE DISTINCTION
  // =========================================================================
  describe("5. List/detail APIs active/inactive distinction and filtering", () => {
    it("5.1 List API distinguishes active and inactive employees and supports ?status= filter", async () => {
      const { employee: activeEmp } = await setupTestEmployeeWithRelatedData("EMP013A");
      const { employee: inactiveEmp } = await setupTestEmployeeWithRelatedData("EMP013B");

      // Deactivate one employee
      await request(app).post(`/api/employee/${inactiveEmp._id}/deactivate`);

      // 1. Fetch all employees (default)
      const allRes = await request(app).get("/api/employee/list");
      expect(allRes.status).toBe(200);
      expect(allRes.body.success).toBe(true);

      const foundActive = allRes.body.employees.find((e) => e._id.toString() === activeEmp._id.toString());
      const foundInactive = allRes.body.employees.find((e) => e._id.toString() === inactiveEmp._id.toString());

      expect(foundActive.isDeactivated).toBe(false);
      expect(foundActive.isActive).toBe(true);
      expect(foundInactive.isDeactivated).toBe(true);
      expect(foundInactive.isActive).toBe(false);

      // 2. Fetch ?status=active only
      const activeOnlyRes = await request(app).get("/api/employee/list?status=active");
      expect(activeOnlyRes.status).toBe(200);
      const activeIds = activeOnlyRes.body.employees.map((e) => e._id.toString());
      expect(activeIds).toContain(activeEmp._id.toString());
      expect(activeIds).not.toContain(inactiveEmp._id.toString());

      // 3. Fetch ?status=inactive only
      const inactiveOnlyRes = await request(app).get("/api/employee/list?status=inactive");
      expect(inactiveOnlyRes.status).toBe(200);
      const inactiveIds = inactiveOnlyRes.body.employees.map((e) => e._id.toString());
      expect(inactiveIds).toContain(inactiveEmp._id.toString());
      expect(inactiveIds).not.toContain(activeEmp._id.toString());
    });
  });

  // =========================================================================
  // 6. LEGACY DELETE CALLERS MIGRATION (SAFE SOFT DELETION)
  // =========================================================================
  describe("6. Callers of old permanent-delete endpoints are safely soft-deactivated", () => {
    it("6.1 DELETE /api/employee/delete/:id soft-deactivates instead of hard-deleting", async () => {
      const { employee, attendance } = await setupTestEmployeeWithRelatedData("EMP014");

      const delRes = await request(app).delete(`/api/employee/delete/${employee._id}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.deletedEmployeeId).toBe(employee._id.toString());

      // Verify Employee still exists in DB as Inactive
      const empInDb = await Employee.findById(employee._id);
      expect(empInDb).not.toBeNull();
      expect(empInDb.isDeactivated).toBe(true);
      expect(empInDb.employeeStatus).toBe("Inactive");

      // Verify Attendance is NOT deleted
      const attInDb = await Attendance.findById(attendance._id);
      expect(attInDb).not.toBeNull();
    });

    it("6.2 DELETE /api/employee/remove/:id soft-deactivates instead of hard-deleting", async () => {
      const { employee, monthlySalary } = await setupTestEmployeeWithRelatedData("EMP015");

      const remRes = await request(app).delete(`/api/employee/remove/${employee._id}`);
      expect(remRes.status).toBe(200);
      expect(remRes.body.success).toBe(true);

      const empInDb = await Employee.findById(employee._id);
      expect(empInDb).not.toBeNull();
      expect(empInDb.isDeactivated).toBe(true);

      const salInDb = await MonthlySalary.findById(monthlySalary._id);
      expect(salInDb).not.toBeNull();
    });
  });

  // =========================================================================
  // 7. EXCEPTIONAL ADMINISTRATIVE HARD DELETION
  // =========================================================================
  describe("7. Exceptional administrative hard deletion (Super Admin only)", () => {
    it("7.1 Non-super admin is blocked from hard-delete (403)", async () => {
      const { employee } = await setupTestEmployeeWithRelatedData("EMP016");
      currentAuthUser = adminUser; // Admin, not Super Admin

      const res = await request(app)
        .delete(`/api/employee/hard-delete/${employee._id}`)
        .send({ confirmHardDelete: true });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/(strictly restricted to Super Admin|not authorized)/i);
    });

    it("7.2 Hard delete without confirmHardDelete confirmation flag returns 400", async () => {
      const { employee } = await setupTestEmployeeWithRelatedData("EMP017");
      currentAuthUser = superAdminUser;

      const res = await request(app).delete(`/api/employee/hard-delete/${employee._id}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("requires explicit confirmation");
    });

    it("7.3 Super admin with confirmHardDelete flag permanently hard-deletes employee", async () => {
      const { employee, empUser } = await setupTestEmployeeWithRelatedData("EMP018");
      currentAuthUser = superAdminUser;

      const res = await request(app)
        .delete(`/api/employee/hard-delete/${employee._id}`)
        .send({ confirmHardDelete: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const empInDb = await Employee.findById(employee._id);
      expect(empInDb).toBeNull();

      const userInDb = await User.findById(empUser._id);
      expect(userInDb).toBeNull();
    });
  });
});
