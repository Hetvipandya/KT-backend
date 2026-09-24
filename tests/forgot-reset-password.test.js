const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");
const crypto = require("crypto");

const User = require("../models/User");
const finAuthRoutes = require("../routes/auth.routes");
const ktUserRoutes = require("../routes/userRoutes");

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/auth", finAuthRoutes);
  app.use("/api/users", ktUserRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe("Forgot & Reset Password Full Flow", () => {
  it("should complete forgot-password and reset-password flow via /api/users routes", async () => {
    // 1. Create a user
    const testUser = new User({
      name: "Test User",
      email: "testuser@example.com",
      password: "OldPassword123",
      role: "employee",
      isApproved: true,
    });
    await testUser.save();

    // Verify initial login works
    const initUser = await User.findOne({ email: "testuser@example.com" }).select("+password +passwordHash");
    expect(await initUser.comparePassword("OldPassword123")).toBe(true);

    // 2. Request forgot password
    const forgotRes = await request(app)
      .post("/api/users/forgot-password")
      .send({ email: "testuser@example.com" });

    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.success).toBe(true);
    expect(forgotRes.body.resetUrl).toBeDefined();

    // Extract token from resetUrl
    const urlParams = new URLSearchParams(forgotRes.body.resetUrl.split("?")[1]);
    const plainToken = urlParams.get("token");
    expect(plainToken).toBeTruthy();

    // 3. Reset password (without sending email in body, only token & newPassword)
    const resetRes = await request(app)
      .post("/api/users/reset-password")
      .send({
        token: plainToken,
        newPassword: "NewSecurePassword123",
        confirmPassword: "NewSecurePassword123",
      });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // 4. Verify DB state and password match
    const updatedUser = await User.findOne({ email: "testuser@example.com" }).select(
      "+password +passwordHash +passwordResetTokenHash +resetPasswordToken",
    );
    expect(await updatedUser.comparePassword("OldPassword123")).toBe(false);
    expect(await updatedUser.comparePassword("NewSecurePassword123")).toBe(true);

    // Verify token fields are cleared
    expect(updatedUser.passwordResetTokenHash).toBeFalsy();
    expect(updatedUser.resetPasswordToken).toBeFalsy();
  });

  it("should complete forgot-password and reset-password flow via /api/auth routes", async () => {
    // 1. Create a user
    const testUser = new User({
      name: "Finance User",
      email: "finance@example.com",
      password: "FinanceOld123",
      role: "admin",
      isApproved: true,
    });
    await testUser.save();

    // 2. Request forgot password via /api/auth/forgot-password
    const forgotRes = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "finance@example.com" });

    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.success).toBe(true);

    // Retrieve user from DB to get generated token hash
    const userInDb = await User.findOne({ email: "finance@example.com" }).select("+passwordResetTokenHash");
    expect(userInDb.passwordResetTokenHash).toBeTruthy();

    // Simulate plain token lookup (we can manually set a known plain token for test)
    const plainToken = "a1b2c3d4e5f67890a1b2c3d4e5f67890";
    const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");
    userInDb.passwordResetTokenHash = tokenHash;
    userInDb.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await userInDb.save();

    // 3. Reset password via /api/auth/reset-password
    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({
        token: plainToken,
        newPassword: "FinanceNewPassword123",
      });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // 4. Verify password match
    const updatedUser = await User.findOne({ email: "finance@example.com" }).select("+password +passwordHash");
    expect(await updatedUser.comparePassword("FinanceOld123")).toBe(false);
    expect(await updatedUser.comparePassword("FinanceNewPassword123")).toBe(true);
  });

  it("should handle web form submission via /api/auth/reset-password-web", async () => {
    const testUser = new User({
      name: "Web User",
      email: "webuser@example.com",
      password: "WebOldPassword123",
      role: "employee",
      isApproved: true,
    });
    await testUser.save();

    const plainToken = "999888777666555444333222111000ab";
    const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");
    testUser.passwordResetTokenHash = tokenHash;
    testUser.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await testUser.save();

    const resetRes = await request(app)
      .post("/api/auth/reset-password-web")
      .set("Accept", "application/json")
      .send({
        token: plainToken,
        newPassword: "WebNewPassword123",
        confirmPassword: "WebNewPassword123",
      });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    const updatedUser = await User.findOne({ email: "webuser@example.com" }).select("+password +passwordHash");
    expect(await updatedUser.comparePassword("WebNewPassword123")).toBe(true);
  });

  it("should accept a token that is already stored as a hash", async () => {
    const testUser = new User({
      name: "Hash Token User",
      email: "hashtoken@example.com",
      password: "OldPassword123",
      role: "employee",
      isApproved: true,
    });
    await testUser.save();

    const plainToken = "abc123def4567890fedcba0987654321abcdef1234567890abcdef1234567890";
    const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");
    testUser.passwordResetTokenHash = tokenHash;
    testUser.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await testUser.save();

    const resetRes = await request(app)
      .post("/api/users/reset-password")
      .send({
        token: tokenHash,
        newPassword: "NewSecurePassword123",
        confirmPassword: "NewSecurePassword123",
      });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    const updatedUser = await User.findOne({ email: "hashtoken@example.com" }).select("+password +passwordHash");
    expect(await updatedUser.comparePassword("NewSecurePassword123")).toBe(true);
  });
});
