const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Company = require("../models/Company");
const Branch = require("../models/Branch");
const User = require("../models/User");
const branchRoutes = require("../routes/branch.routes");
const { generateAccessToken } = require("../utils/jwt");

describe("Branch Management & Duplicate Code Protection Test Suite", () => {
  let mongoServer;
  let app;
  let companyDoc;
  let adminUser;
  let employeeUser;
  let adminToken;
  let employeeToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create test company
    companyDoc = await Company.create({
      name: "Kevalon Technology",
      companyName: "Kevalon Technology Pvt Ltd",
      email: "admin@kevalontechnology.com",
    });

    // Create admin user
    adminUser = await User.create({
      name: "Admin User",
      email: "admin.branch@kevalon.com",
      phoneNumber: "9820000001",
      password: "password123",
      role: "admin",
      companyId: companyDoc._id,
      isApproved: true,
      status: "Active",
    });

    // Create employee user
    employeeUser = await User.create({
      name: "Standard Employee",
      email: "employee.branch@kevalon.com",
      phoneNumber: "9820000002",
      password: "password123",
      role: "employee",
      companyId: companyDoc._id,
      isApproved: true,
      status: "Active",
    });

    adminToken = generateAccessToken({
      userId: adminUser._id,
      email: adminUser.email,
      role: adminUser.role,
    });

    employeeToken = generateAccessToken({
      userId: employeeUser._id,
      email: employeeUser.email,
      role: employeeUser.role,
    });

    app = express();
    app.use(express.json());
    app.use("/api/branch", branchRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    await Branch.deleteMany({});
  });

  describe("1. GET /api/branch (Branch Listing & Access Control)", () => {
    test("returns branch list when requested by Admin without query parameters", async () => {
      await Branch.create({
        companyId: companyDoc._id,
        branchName: "Ahmedabad HQ",
        branchCode: "AHM-HQ",
        isHeadOffice: true,
        status: "active",
      });

      const res = await request(app)
        .get("/api/branch")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].branchCode).toBe("AHM-HQ");
      expect(res.body.data[0].branchName).toBe("Ahmedabad HQ");
    });

    test("returns branch list when requested by Employee without 403 or 400 error", async () => {
      await Branch.create({
        companyId: companyDoc._id,
        branchName: "Surat Regional",
        branchCode: "SRT-01",
        isHeadOffice: false,
        status: "active",
      });

      const res = await request(app)
        .get("/api/branch")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].branchCode).toBe("SRT-01");
    });

    test("returns branches even if companyId is null in legacy branch records", async () => {
      await Branch.create({
        companyId: null,
        branchName: "Legacy Head Office",
        branchCode: "LEG-01",
        isHeadOffice: true,
        status: "active",
      });

      const res = await request(app)
        .get("/api/branch")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].branchName).toBe("Legacy Head Office");
    });

    test("filters branches by status query param (?status=active)", async () => {
      await Branch.create([
        {
          companyId: companyDoc._id,
          branchName: "Active Branch",
          branchCode: "ACT-01",
          status: "active",
        },
        {
          companyId: companyDoc._id,
          branchName: "Inactive Branch",
          branchCode: "INA-01",
          status: "inactive",
        },
      ]);

      const res = await request(app)
        .get("/api/branch?status=active")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].branchCode).toBe("ACT-01");
    });
  });

  describe("2. POST /api/branch (Branch Creation & Head Office Rules)", () => {
    test("creates first branch and automatically designates it as Head Office", async () => {
      const payload = {
        companyId: companyDoc._id.toString(),
        branchName: "Corporate Office",
        branchCode: "CORP-01",
        city: "Ahmedabad",
        state: "Gujarat",
      };

      const res = await request(app)
        .post("/api/branch")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.branchCode).toBe("CORP-01");
      expect(res.body.data.isHeadOffice).toBe(true);
    });

    test("trims whitespace from branchCode on creation", async () => {
      const payload = {
        companyId: companyDoc._id.toString(),
        branchName: "Vadodara Unit",
        branchCode: "  BR-VAD-01  ",
      };

      const res = await request(app)
        .post("/api/branch")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.branchCode).toBe("BR-VAD-01");
    });
  });

  describe("3. Duplicate Branch Code Protection", () => {
    test("rejects creating second branch with exact same branchCode", async () => {
      // First branch
      await request(app)
        .post("/api/branch")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          companyId: companyDoc._id.toString(),
          branchName: "Branch Alpha",
          branchCode: "CODE-100",
        });

      // Second branch with same code
      const res = await request(app)
        .post("/api/branch")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          companyId: companyDoc._id.toString(),
          branchName: "Branch Beta",
          branchCode: "CODE-100",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe("DUPLICATE_BRANCH_CODE");
      expect(res.body.message).toContain("already exists");
    });

    test("rejects creating branch with case-insensitive duplicate branchCode (e.g. code-100 vs CODE-100)", async () => {
      await request(app)
        .post("/api/branch")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          companyId: companyDoc._id.toString(),
          branchName: "Branch One",
          branchCode: "CODE-200",
        });

      const res = await request(app)
        .post("/api/branch")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          companyId: companyDoc._id.toString(),
          branchName: "Branch Two",
          branchCode: "code-200",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe("DUPLICATE_BRANCH_CODE");
    });

    test("rejects PUT /api/branch/:id if updated branchCode belongs to another branch", async () => {
      const branch1 = await Branch.create({
        companyId: companyDoc._id,
        branchName: "Branch A",
        branchCode: "CODE-A",
        isHeadOffice: true,
      });

      const branch2 = await Branch.create({
        companyId: companyDoc._id,
        branchName: "Branch B",
        branchCode: "CODE-B",
        isHeadOffice: false,
      });

      // Try to update branch2 to use branch1's code
      const res = await request(app)
        .put(`/api/branch/${branch2._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          branchCode: "code-a", // case-insensitive duplicate
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe("DUPLICATE_BRANCH_CODE");
    });

    test("allows PUT /api/branch/:id when saving same branch with its own branchCode", async () => {
      const branch1 = await Branch.create({
        companyId: companyDoc._id,
        branchName: "Branch Original",
        branchCode: "KEEP-ME",
        isHeadOffice: true,
      });

      const res = await request(app)
        .put(`/api/branch/${branch1._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          branchName: "Branch Renamed",
          branchCode: "KEEP-ME",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.branchName).toBe("Branch Renamed");
      expect(res.body.data.branchCode).toBe("KEEP-ME");
    });
  });

  describe("4. PUT /api/branch/:id Business Rules", () => {
    test("prevents unsetting Head Office if it is the only branch", async () => {
      const branch = await Branch.create({
        companyId: companyDoc._id,
        branchName: "Sole Branch",
        branchCode: "SOLE-01",
        isHeadOffice: true,
      });

      const res = await request(app)
        .put(`/api/branch/${branch._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          isHeadOffice: false,
        });

      // It automatically preserves head office status
      expect(res.status).toBe(200);
      expect(res.body.data.isHeadOffice).toBe(true);
    });
  });
});
