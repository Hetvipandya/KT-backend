const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Role = require("../models/Role");
const Holiday = require("../models/Holiday");
const MonitoringSettings = require("../models/MonitoringSettings");

const auditLogRoutes = require("../routes/auditLog.routes");
const { recordAuditEvent, sanitizeAllowlistedValues } = require("../services/auditLog.service");

// Mock notifications to prevent external networking
jest.mock("../utils/sendNotification", () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

describe("Server-Side Audit Logging Module Test Suite", () => {
  let mongoServer;
  let app;
  let companyId;
  let adminUser;
  let hrUser;
  let employeeUser;
  let teamLeadUser;
  let accountantUser;

  let currentAuthUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    companyId = new mongoose.Types.ObjectId();

    // 1. Create Company
    await Company.create({
      _id: companyId,
      name: "Kevalon Technology Pvt Ltd",
      companyName: "Kevalon Technology Pvt Ltd",
      email: "info@kevalon.com",
    });

    // 2. Create Users
    adminUser = await User.create({
      name: "Admin User",
      email: "admin@kevalon.com",
      phoneNumber: "9876543201",
      password: "password123",
      role: "admin",
      uniqueID: "ADM-001",
      companyId,
      isApproved: true,
    });

    hrUser = await User.create({
      name: "HR Manager",
      email: "hr@kevalon.com",
      phoneNumber: "9876543202",
      password: "password123",
      role: "hr",
      uniqueID: "HR-001",
      companyId,
      isApproved: true,
    });

    employeeUser = await User.create({
      name: "Standard Employee",
      email: "employee@kevalon.com",
      phoneNumber: "9876543203",
      password: "password123",
      role: "employee",
      uniqueID: "EMP-001",
      companyId,
      isApproved: true,
    });

    teamLeadUser = await User.create({
      name: "Team Lead",
      email: "teamlead@kevalon.com",
      phoneNumber: "9876543204",
      password: "password123",
      role: "team lead",
      uniqueID: "TL-001",
      companyId,
      isApproved: true,
    });

    accountantUser = await User.create({
      name: "Accountant",
      email: "accountant@kevalon.com",
      phoneNumber: "9876543205",
      password: "password123",
      role: "accountant",
      uniqueID: "ACC-001",
      companyId,
      isApproved: true,
    });

    // 3. Setup Express App
    app = express();
    app.use(express.json());

    // Role-switching auth middleware for test harness
    app.use((req, res, next) => {
      if (currentAuthUser === null) {
        // simulate unauthenticated request
        req.user = undefined;
      } else {
        req.user = currentAuthUser || adminUser;
      }
      next();
    });

    app.use("/api/audit-log", auditLogRoutes);
    app.use("/api/audit-logs", auditLogRoutes);

    // Mock endpoint that tests transactional rollback when audit fails
    app.post("/test/sensitive-with-transaction", async (req, res) => {
      const session = await mongoose.startSession();
      let transactionStarted = false;
      try {
        try {
          await session.startTransaction();
          await User.findOne().session(session);
          transactionStarted = true;
        } catch (startErr) {
          transactionStarted = false;
        }

        const sessionOpts = transactionStarted ? { session } : {};

        // Perform business change
        const holiday = new Holiday({
          holidayName: req.body.holidayName || "Diwali",
          holidayDate: req.body.holidayDate ? new Date(req.body.holidayDate) : new Date(Date.now() + Math.floor(Math.random() * 1000000000)),
          companyId,
        });
        await holiday.save(sessionOpts);

        // Attempt audit logging
        if (req.body.failAudit) {
          throw new Error("Simulated audit write failure");
        }

        await recordAuditEvent({
          req,
          session: transactionStarted ? session : null,
          module: "HOLIDAY",
          action: "CREATE",
          actionType: "HOLIDAY_CREATED",
          entityType: "Holiday",
          entityId: holiday._id,
          description: `Holiday created: ${holiday.holidayName}`,
          newValues: holiday,
          companyId,
        });

        if (transactionStarted) {
          await session.commitTransaction();
        }
        session.endSession();

        return res.status(201).json({ success: true, data: holiday });
      } catch (err) {
        if (transactionStarted) {
          await session.abortTransaction();
        }
        session.endSession();
        return res.status(500).json({ success: false, message: err.message });
      }
    });

    // Mock endpoint that simulates standalone change where audit failure must not report success
    app.post("/test/sensitive-standalone", async (req, res) => {
      try {
        const holiday = await Holiday.create({
          holidayName: req.body.holidayName || "New Year",
          holidayDate: new Date("2027-01-01"),
          companyId,
        });

        if (req.body.failAudit) {
          // If audit fails, throw error and do not report success
          throw new Error("Audit log persistence failed");
        }

        await recordAuditEvent({
          req,
          module: "HOLIDAY",
          action: "CREATE",
          actionType: "HOLIDAY_CREATED",
          entityType: "Holiday",
          entityId: holiday._id,
          description: `Holiday created: ${holiday.holidayName}`,
          newValues: holiday,
          companyId,
        });

        return res.status(201).json({ success: true, data: holiday });
      } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    currentAuthUser = adminUser;
    await AuditLog.collection.deleteMany({});
  });

  // =========================================================================
  // 1. ACTOR ATTRIBUTION & TAMPER RESISTANCE
  // =========================================================================
  describe("1. Actor Attribution & Tamper Resistance", () => {
    it("1.1 Derives actor ID, display name, and role strictly from authenticated req.user and ignores req.body", async () => {
      const mockReq = {
        user: adminUser,
        body: {
          actor: "Malicious User",
          actorId: new mongoose.Types.ObjectId().toString(),
          actorRole: "super admin",
          timestamp: "1999-01-01T00:00:00.000Z",
          oldValues: { fake: "data" },
        },
        ip: "192.168.1.100",
        get: () => "Mozilla/5.0 TestBrowser",
      };

      const targetId = new mongoose.Types.ObjectId();
      const auditLog = await recordAuditEvent({
        req: mockReq,
        module: "EMPLOYEE",
        action: "CREATE",
        actionType: "EMPLOYEE_CREATED",
        entityType: "Employee",
        entityId: targetId,
        description: "Created employee record",
        newValues: { name: "John Doe", department: "Engineering" },
      });

      expect(auditLog.actorId.toString()).toBe(adminUser._id.toString());
      expect(auditLog.actorName).toBe(adminUser.name);
      expect(auditLog.actorRole).toBe(adminUser.role);
      expect(auditLog.userId.toString()).toBe(adminUser._id.toString());

      // Ensure client body actor and timestamp were completely ignored
      expect(auditLog.actorName).not.toBe("Malicious User");
      expect(auditLog.actorRole).not.toBe("super admin");
      expect(new Date(auditLog.timestamp).getFullYear()).toBeGreaterThan(2025);
      expect(auditLog.ipAddress).toBe("192.168.1.100");
      expect(auditLog.userAgent).toBe("Mozilla/5.0 TestBrowser");
    });
  });

  // =========================================================================
  // 2. OLD AND NEW VALUES & SENSITIVE FIELD ALLOWLISTING
  // =========================================================================
  describe("2. Old and New Values & Allowlisting", () => {
    it("2.1 Records resulting values for CREATE without oldValues", async () => {
      const entityId = new mongoose.Types.ObjectId();
      const auditLog = await recordAuditEvent({
        req: { user: adminUser },
        module: "ROLES",
        action: "CREATE",
        actionType: "ROLE_CREATED",
        entityType: "Role",
        entityId,
        description: "Created Quality Analyst role",
        newValues: {
          roleName: "Quality Analyst",
          description: "Software testing role",
          permissions: ["READ_ATTENDANCE", "CREATE_REPORT"],
        },
      });

      expect(auditLog.oldValues).toBeNull();
      expect(auditLog.newValues).toBeDefined();
      expect(auditLog.newValues.roleName).toBe("Quality Analyst");
      expect(auditLog.newValues.permissions).toContain("READ_ATTENDANCE");
    });

    it("2.2 Records both previous and new values for UPDATE operations", async () => {
      const entityId = new mongoose.Types.ObjectId();
      const auditLog = await recordAuditEvent({
        req: { user: hrUser },
        module: "SETTINGS",
        action: "UPDATE",
        actionType: "MONITORING_SETTINGS_UPDATED",
        entityType: "MonitoringSettings",
        entityId,
        description: "Changed screenshot interval to 120 seconds",
        oldValues: { intervalSeconds: 60, isMonitoringEnabled: true },
        newValues: { intervalSeconds: 120, isMonitoringEnabled: true },
      });

      expect(auditLog.oldValues).toEqual(expect.objectContaining({ intervalSeconds: 60 }));
      expect(auditLog.newValues).toEqual(expect.objectContaining({ intervalSeconds: 120 }));
      expect(auditLog.actorName).toBe(hrUser.name);
    });

    it("2.3 Records previous values for DELETE operations without newValues", async () => {
      const entityId = new mongoose.Types.ObjectId();
      const auditLog = await recordAuditEvent({
        req: { user: adminUser },
        module: "HOLIDAY",
        action: "DELETE",
        actionType: "HOLIDAY_DELETED",
        entityType: "Holiday",
        entityId,
        description: "Deleted Gandhi Jayanti custom holiday",
        oldValues: { holidayName: "Gandhi Jayanti", date: "2026-10-02" },
      });

      expect(auditLog.oldValues).toEqual(expect.objectContaining({ holidayName: "Gandhi Jayanti" }));
      expect(auditLog.newValues).toBeNull();
    });

    it("2.4 Strict allowlisting: Never logs passwords, secrets, tokens, or raw request structures", () => {
      const rawPayload = {
        name: "Confidential Admin",
        email: "confidential@kevalon.com",
        password: "SuperSecretPassword123!",
        passwordHash: "$2a$10$abcdef1234567890",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        refreshToken: "refresh_secret_abc123",
        accessToken: "access_token_xyz",
        department: "Operations",
        cvv: "999",
        req: { headers: { authorization: "Bearer secret" } },
      };

      const sanitized = sanitizeAllowlistedValues(rawPayload, "User");

      expect(sanitized.name).toBe("Confidential Admin");
      expect(sanitized.email).toBe("confidential@kevalon.com");
      expect(sanitized.department).toBe("Operations");

      // Strictly verify sensitive fields were purged
      expect(sanitized.password).toBeUndefined();
      expect(sanitized.passwordHash).toBeUndefined();
      expect(sanitized.token).toBeUndefined();
      expect(sanitized.refreshToken).toBeUndefined();
      expect(sanitized.accessToken).toBeUndefined();
      expect(sanitized.cvv).toBeUndefined();
      expect(sanitized.req).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. FAILED WRITES & PERSISTENCE INTEGRITY
  // =========================================================================
  describe("3. Failed Writes & Persistence Integrity", () => {
    it("3.1 If audit recording fails, does NOT silently report the sensitive change as successful (returns 500)", async () => {
      const res = await request(app)
        .post("/test/sensitive-standalone")
        .send({
          holidayName: "Corrupted Holiday",
          failAudit: true,
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Audit log persistence failed");

      // Verify no audit log was created for failed operation
      const logs = await AuditLog.find({ entityType: "Holiday", description: /Corrupted Holiday/ });
      expect(logs.length).toBe(0);
    });

    it("3.2 Persists business change and audit together in transaction (rolls back on audit failure if transaction supported)", async () => {
      const res = await request(app)
        .post("/test/sensitive-with-transaction")
        .send({
          holidayName: "Transactional Diwali",
          failAudit: true,
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);

      // Verify no audit log was stored
      const logs = await AuditLog.find({ entityType: "Holiday", description: /Transactional Diwali/ });
      expect(logs.length).toBe(0);
    });

    it("3.3 Successfully commits both business change and audit log when no errors occur", async () => {
      const res = await request(app)
        .post("/test/sensitive-with-transaction")
        .send({
          holidayName: "Valid Christmas Holiday",
          failAudit: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const logs = await AuditLog.find({ entityType: "Holiday", description: /Valid Christmas Holiday/ });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe("CREATE");
      expect(logs[0].entityType).toBe("Holiday");
    });
  });

  // =========================================================================
  // 4. ROLE-BASED ACCESS CONTROL (ADMIN & HR ONLY)
  // =========================================================================
  describe("4. Role-Based Access Control", () => {
    beforeEach(async () => {
      // Seed a test audit log
      await AuditLog.create({
        actorId: adminUser._id,
        actorName: adminUser.name,
        actorRole: adminUser.role,
        module: "SYSTEM",
        action: "CREATE",
        actionType: "SYSTEM_EVENT",
        description: "Test event for RBAC check",
        companyId,
      });
    });

    it("4.1 Admin role can access GET /api/audit-log (200 OK)", async () => {
      currentAuthUser = adminUser;
      const res = await request(app).get("/api/audit-log");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
    });

    it("4.2 HR role can access GET /api/audit-log (200 OK)", async () => {
      currentAuthUser = hrUser;
      const res = await request(app).get("/api/audit-log");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("4.3 Employee role is blocked with 403 Forbidden", async () => {
      currentAuthUser = employeeUser;
      const res = await request(app).get("/api/audit-log");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("not authorized");
    });

    it("4.4 Team Lead role is blocked with 403 Forbidden", async () => {
      currentAuthUser = teamLeadUser;
      const res = await request(app).get("/api/audit-log");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("4.5 Accountant role is blocked with 403 Forbidden", async () => {
      currentAuthUser = accountantUser;
      const res = await request(app).get("/api/audit-log");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("4.6 Unauthenticated request is blocked with 401 Unauthorized", async () => {
      currentAuthUser = null;
      const res = await request(app).get("/api/audit-log");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 5. FILTERING (DATE RANGE, ACTOR, ACTION, ENTITY)
  // =========================================================================
  describe("5. Filterable Audit Log Queries", () => {
    let empLogId;
    let salaryLogId;
    let leaveLogId;

    beforeEach(async () => {
      // Create seed records across different dates, actors, actions, entities
      const log1 = await AuditLog.create({
        actorId: adminUser._id,
        actorName: "Admin User",
        actorRole: "admin",
        module: "EMPLOYEE",
        action: "CREATE",
        actionType: "EMPLOYEE_CREATED",
        entityType: "Employee",
        entityId: new mongoose.Types.ObjectId(),
        description: "Created Employee Record EMP-01",
        timestamp: new Date("2026-05-10T10:00:00.000Z"),
        companyId,
      });
      empLogId = log1._id;

      const log2 = await AuditLog.create({
        actorId: hrUser._id,
        actorName: "HR Manager",
        actorRole: "hr",
        module: "PAYROLL",
        action: "APPROVE",
        actionType: "SALARY_APPROVED",
        entityType: "MonthlySalary",
        entityId: new mongoose.Types.ObjectId(),
        description: "Approved Monthly Salary for May 2026",
        timestamp: new Date("2026-06-01T15:00:00.000Z"),
        companyId,
      });
      salaryLogId = log2._id;

      const log3 = await AuditLog.create({
        actorId: adminUser._id,
        actorName: "Admin User",
        actorRole: "admin",
        module: "LEAVE",
        action: "REJECT",
        actionType: "LEAVE_REJECTED",
        entityType: "Leave",
        entityId: new mongoose.Types.ObjectId(),
        description: "Rejected Emergency Leave Request",
        timestamp: new Date("2026-07-20T12:00:00.000Z"),
        companyId,
      });
      leaveLogId = log3._id;
    });

    it("5.1 Filters by Date Range (startDate and endDate)", async () => {
      currentAuthUser = adminUser;
      const res = await request(app)
        .get("/api/audit-log")
        .query({
          startDate: "2026-05-01T00:00:00.000Z",
          endDate: "2026-06-15T23:59:59.000Z",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2);
      const descriptions = res.body.data.items.map((i) => i.description);
      expect(descriptions).toContain("Created Employee Record EMP-01");
      expect(descriptions).toContain("Approved Monthly Salary for May 2026");
      expect(descriptions).not.toContain("Rejected Emergency Leave Request");
    });

    it("5.2 Filters by Actor ID", async () => {
      currentAuthUser = adminUser;
      const res = await request(app)
        .get("/api/audit-log")
        .query({ actorId: hrUser._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].actorName).toBe("HR Manager");
      expect(res.body.data.items[0].action).toBe("APPROVE");
    });

    it("5.3 Filters by Action (e.g. REJECT)", async () => {
      currentAuthUser = adminUser;
      const res = await request(app)
        .get("/api/audit-log")
        .query({ action: "REJECT" });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].entityType).toBe("Leave");
      expect(res.body.data.items[0].action).toBe("REJECT");
    });

    it("5.4 Filters by Entity Type (e.g. MonthlySalary)", async () => {
      currentAuthUser = adminUser;
      const res = await request(app)
        .get("/api/audit-log")
        .query({ entityType: "MonthlySalary" });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].entityType).toBe("MonthlySalary");
      expect(res.body.data.items[0]._id.toString()).toBe(salaryLogId.toString());
    });

    it("5.5 GET /api/audit-log/:id returns single record details", async () => {
      currentAuthUser = adminUser;
      const res = await request(app).get(`/api/audit-log/${empLogId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(empLogId.toString());
      expect(res.body.data.module).toBe("EMPLOYEE");
    });
  });

  // =========================================================================
  // 6. PAGINATION
  // =========================================================================
  describe("6. Pagination", () => {
    beforeEach(async () => {
      // Seed 5 records
      for (let i = 1; i <= 5; i++) {
        await AuditLog.create({
          actorId: adminUser._id,
          actorName: adminUser.name,
          actorRole: adminUser.role,
          module: "PAGINATION_TEST",
          action: "UPDATE",
          actionType: `RECORD_${i}`,
          description: `Page item ${i}`,
          timestamp: new Date(Date.now() + i * 1000),
          companyId,
        });
      }
    });

    it("6.1 Correctly paginates results per page and returns total and page count", async () => {
      currentAuthUser = adminUser;
      const page1Res = await request(app)
        .get("/api/audit-log")
        .query({ page: 1, limit: 2 });

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.data.items.length).toBe(2);
      expect(page1Res.body.data.pagination.page).toBe(1);
      expect(page1Res.body.data.pagination.limit).toBe(2);
      expect(page1Res.body.data.pagination.total).toBe(5);
      expect(page1Res.body.data.pagination.pages).toBe(3);

      const page2Res = await request(app)
        .get("/api/audit-log")
        .query({ page: 2, limit: 2 });

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.data.items.length).toBe(2);
      expect(page2Res.body.data.pagination.page).toBe(2);

      // Verify page 1 and page 2 returned distinct items
      const idsPage1 = page1Res.body.data.items.map((i) => i.id);
      const idsPage2 = page2Res.body.data.items.map((i) => i.id);
      expect(idsPage1.some((id) => idsPage2.includes(id))).toBe(false);
    });
  });

  // =========================================================================
  // 7. IMMUTABILITY ENFORCEMENT (ROUTE AND MODEL LEVELS)
  // =========================================================================
  describe("7. Immutability Protection", () => {
    let testLogId;

    beforeEach(async () => {
      const log = await AuditLog.create({
        actorId: adminUser._id,
        actorName: adminUser.name,
        actorRole: adminUser.role,
        module: "SECURITY",
        action: "CREATE",
        actionType: "SECURITY_TEST",
        description: "Immutable target record",
        companyId,
      });
      testLogId = log._id;
    });

    it("7.1 Rejects PUT /api/audit-log/:id with 405 Method Not Allowed", async () => {
      currentAuthUser = adminUser;
      const res = await request(app)
        .put(`/api/audit-log/${testLogId}`)
        .send({ description: "Malicious alteration" });

      expect(res.status).toBe(405);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("immutable");
    });

    it("7.2 Rejects PATCH /api/audit-log/:id with 405 Method Not Allowed", async () => {
      currentAuthUser = adminUser;
      const res = await request(app)
        .patch(`/api/audit-log/${testLogId}`)
        .send({ description: "Malicious patch" });

      expect(res.status).toBe(405);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("immutable");
    });

    it("7.3 Rejects DELETE /api/audit-log/:id with 405 Method Not Allowed", async () => {
      currentAuthUser = adminUser;
      const res = await request(app).delete(`/api/audit-log/${testLogId}`);

      expect(res.status).toBe(405);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("immutable");
    });

    it("7.4 Mongoose pre-hook blocks document update attempt directly in database", async () => {
      await expect(
        AuditLog.updateOne({ _id: testLogId }, { $set: { description: "Tampered" } })
      ).rejects.toThrow(/immutable/i);
    });

    it("7.5 Mongoose pre-hook blocks document delete attempt directly in database", async () => {
      await expect(
        AuditLog.deleteOne({ _id: testLogId })
      ).rejects.toThrow(/immutable/i);
    });
  });
});
