const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");

const User = require("../models/User");
const Employee = require("../models/Employee");
const ktUserRoutes = require("../routes/userRoutes");
const finAuthRoutes = require("../routes/auth.routes");

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/users", ktUserRoutes);
  app.use("/api/auth", finAuthRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Employee.deleteMany({});
});

describe("Complete End-to-End Password and Auth Verification", () => {
  it("Scenario 1: Registration -> Admin Approval -> Temp Password Login -> Employee Profile Update -> Logout -> Login with Temp Password succeeds", async () => {
    // 1. Employee registers
    const regRes = await request(app)
      .post("/api/users/register")
      .send({
        name: "Hetvi Patel",
        email: "hetvi.patel@example.com",
        phoneNumber: "9876543210",
        department: "Engineering",
        designation: "Developer",
        role: "employee",
        dob: "2000-01-01",
        address: "123 Main St",
        bloodGroup: "O+",
      });
    expect(regRes.status).toBe(201);

    const user = await User.findOne({ email: "hetvi.patel@example.com" });
    expect(user.isApproved).toBe(false);

    // 2. Admin approves from employee requests with temporary password
    const tempPass = "TempPass789!";
    const approveRes = await request(app)
      .put(`/api/users/approve/${user._id}`)
      .send({ userId: user._id.toString(), tempPassword: tempPass });
    expect(approveRes.status).toBe(200);

    // 3. Employee logs in for the first time with temporary password
    const login1 = await request(app)
      .post("/api/users/login")
      .send({ email: "hetvi.patel@example.com", password: tempPass });
    expect(login1.status).toBe(200);
    const token = login1.body.token;

    // 4. Employee profile or data gets updated in the system
    const emp = await Employee.findOne({ userID: user._id });
    const { syncEmployeeToUser } = require("../utils/userEmployeeSync");
    await syncEmployeeToUser({
      employee: emp,
      role: "employee",
      userData: {
        name: "Hetvi Patel Updated",
        email: "hetvi.patel@example.com",
        department: "Engineering",
        designation: "Senior Developer",
      },
    });

    // 5. Employee logs out
    const logoutRes = await request(app)
      .post("/api/users/logout")
      .send({ userId: user._id.toString() });
    expect(logoutRes.status).toBe(200);

    // 6. Employee logs in again with the temporary password
    const login2 = await request(app)
      .post("/api/users/login")
      .send({ email: "hetvi.patel@example.com", password: tempPass });
    expect(login2.status).toBe(200);
    expect(login2.body.success).toBe(true);
  });

  it("Scenario 2: Temporary password with copy-paste whitespace matches cleanly", async () => {
    // 1. Register & approve
    await request(app)
      .post("/api/users/register")
      .send({
        name: "Whitespace User",
        email: "whitespace@example.com",
        phoneNumber: "9876543211",
        department: "Engineering",
        designation: "Developer",
        role: "employee",
        dob: "2000-01-01",
        address: "123 Main St",
        bloodGroup: "O+",
      });

    const user = await User.findOne({ email: "whitespace@example.com" });
    const tempPass = "TempPassSpace123";
    await request(app)
      .put(`/api/users/approve/${user._id}`)
      .send({ userId: user._id.toString(), tempPassword: tempPass });

    // Login with leading/trailing spaces as copied from email
    const loginRes = await request(app)
      .post("/api/users/login")
      .send({ email: "whitespace@example.com", password: `  ${tempPass}  ` });
    expect(loginRes.status).toBe(200);
  });

  it("Scenario 3: Mobile OTP Reset Flow: send-otp -> verify-otp -> reset-password without token -> Login with new password", async () => {
    // 1. Register & approve
    await request(app)
      .post("/api/users/register")
      .send({
        name: "OTP User",
        email: "otpuser@example.com",
        phoneNumber: "9876543212",
        department: "Design",
        designation: "Designer",
        role: "employee",
        dob: "2000-01-01",
        address: "456 Main St",
        bloodGroup: "B+",
      });

    const user = await User.findOne({ email: "otpuser@example.com" });
    await request(app)
      .put(`/api/users/approve/${user._id}`)
      .send({ userId: user._id.toString(), tempPassword: "InitialTempPass1" });

    // 2. Request OTP
    const sendOtpRes = await request(app)
      .post("/api/users/send-otp")
      .send({ email: "otpuser@example.com" });
    expect(sendOtpRes.status).toBe(200);

    const userWithOtp = await User.findOne({ email: "otpuser@example.com" });
    const otp = userWithOtp.forgotPasswordOTP;
    expect(otp).toBeDefined();

    // 3. Verify OTP
    const verifyOtpRes = await request(app)
      .post("/api/users/verify-otp")
      .send({ email: "otpuser@example.com", otp });
    expect(verifyOtpRes.status).toBe(200);

    // 4. Reset password using email & new password
    const resetRes = await request(app)
      .post("/api/users/reset-password")
      .send({
        email: "otpuser@example.com",
        newPassword: "BrandNewPassword2026!",
        confirmPassword: "BrandNewPassword2026!",
      });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.message).toBe("Password reset successfully");

    // 5. Login with new password
    const loginRes = await request(app)
      .post("/api/users/login")
      .send({ email: "otpuser@example.com", password: "BrandNewPassword2026!" });
    expect(loginRes.status).toBe(200);

    // 6. Old temporary password no longer works
    const oldLoginRes = await request(app)
      .post("/api/users/login")
      .send({ email: "otpuser@example.com", password: "InitialTempPass1" });
    expect(oldLoginRes.status).toBe(400);
  });

  it("Scenario 4: Web Token Reset Flow: forgot-password -> reset-password with token -> Login with new password", async () => {
    // 1. Register & approve
    await request(app)
      .post("/api/users/register")
      .send({
        name: "Web Reset User",
        email: "webreset@example.com",
        phoneNumber: "9876543213",
        department: "Sales",
        designation: "Executive",
        role: "employee",
        dob: "2000-01-01",
        address: "789 Main St",
        bloodGroup: "A+",
      });

    const user = await User.findOne({ email: "webreset@example.com" });
    await request(app)
      .put(`/api/users/approve/${user._id}`)
      .send({ userId: user._id.toString(), tempPassword: "InitialTempPass2" });

    // 2. Request reset link
    const forgotRes = await request(app)
      .post("/api/users/forgot-password")
      .send({ email: "webreset@example.com" });
    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.resetUrl).toBeDefined();

    const resetToken = new URL(forgotRes.body.resetUrl).searchParams.get("token");
    expect(resetToken).toBeDefined();

    // 3. Reset password using token
    const resetRes = await request(app)
      .post("/api/users/reset-password")
      .send({
        token: resetToken,
        email: "webreset@example.com",
        newPassword: "WebNewPassword2026!",
        confirmPassword: "WebNewPassword2026!",
      });
    expect(resetRes.status).toBe(200);

    // 4. Login with new password
    const loginRes = await request(app)
      .post("/api/users/login")
      .send({ email: "webreset@example.com", password: "WebNewPassword2026!" });
    expect(loginRes.status).toBe(200);
  });

  it("Scenario 5: Employee ID login and case-insensitive email login", async () => {
    // 1. Register & approve
    await request(app)
      .post("/api/users/register")
      .send({
        name: "Case Test User",
        email: "CaseTest@Example.com",
        phoneNumber: "9876543214",
        department: "Marketing",
        designation: "Manager",
        role: "employee",
        dob: "2000-01-01",
        address: "101 Main St",
        bloodGroup: "AB+",
      });

    const user = await User.findOne({ email: "casetest@example.com" });
    await request(app)
      .put(`/api/users/approve/${user._id}`)
      .send({ userId: user._id.toString(), tempPassword: "CaseTestPass123" });

    // 2. Login with uppercase email
    const loginUpper = await request(app)
      .post("/api/users/login")
      .send({ email: "CASETEST@EXAMPLE.COM", password: "CaseTestPass123" });
    expect(loginUpper.status).toBe(200);

    // 3. Login with uniqueID / Employee ID
    const updatedUser = await User.findById(user._id);
    expect(updatedUser.uniqueID).toBeDefined();

    const loginEmpId = await request(app)
      .post("/api/users/login")
      .send({ login: updatedUser.uniqueID, password: "CaseTestPass123" });
    expect(loginEmpId.status).toBe(200);
  });
});
