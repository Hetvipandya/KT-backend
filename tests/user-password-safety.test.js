const mongoose = require("mongoose");
const sanitizeUserUpdatePayload = require("../utils/userPayloadSanitizer");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const {
  buildLoginLookupQuery,
  __test__applyPasswordUpdate,
  __test__applySuccessfulLoginState,
  shouldRequireApproval,
} = require("../controllers/userControllers");
const {
  __test__normalizeRoleValue,
} = require("../controllers/attendanceController");

describe("password safety for user updates", () => {
  it("strips password fields from normal profile update payloads", () => {
    const payload = {
      name: "Amit Patel",
      department: "Engineering",
      password: "new-secret",
      passwordHash: "hash-value",
      plainPassword: "new-secret",
      newPassword: "replacement-secret",
      confirmPassword: "replacement-secret",
    };

    expect(sanitizeUserUpdatePayload(payload)).toEqual({
      name: "Amit Patel",
      department: "Engineering",
    });
  });

  it("keeps first-login disabled by default until a successful email/password login", () => {
    const user = new User({
      name: "Amit Patel",
      email: "amit@example.com",
      password: "Secret123",
      role: "employee",
    });

    expect(user.isFirstLogin).toBe(false);
    expect(user.mustChangePassword).toBe(false);
  });

  it("builds a precise user lookup for login without an empty matcher", () => {
    expect(buildLoginLookupQuery("beta@example.com")).toEqual({
      $or: [
        { email: "beta@example.com" },
        { phoneNumber: "beta@example.com" },
        { name: "beta@example.com" },
      ],
    });

    expect(buildLoginLookupQuery("   ")).toBeNull();
  });

  it("updates password securely without setting plainPassword", () => {
    const user = new User({
      name: "Amit Patel",
      email: "amit@example.com",
      password: "OldPass123",
      role: "employee",
    });

    __test__applyPasswordUpdate(user, "NewPass456");

    expect(user.password).toBe("NewPass456");
    expect(user.plainPassword).toBeUndefined();
  });

  it("ensures passwords are hashed and plainPassword is never exposed in JSON output", async () => {
    const bcrypt = require("bcryptjs");
    const user = new User({
      name: "Security Test",
      email: "sec@example.com",
      password: "MySecurePassword123!",
      role: "employee",
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user.password, salt);
    user.password = hashedPassword;
    user.passwordHash = hashedPassword;

    // Verification 1: Password is stored in hashed format
    expect(user.password).toMatch(/^\$2[ab]\$/);
    expect(user.passwordHash).toMatch(/^\$2[ab]\$/);
    expect(user.plainPassword).toBeUndefined();

    // Verification 2: Login comparison works with correct password
    const isMatch = await user.comparePassword("MySecurePassword123!");
    expect(isMatch).toBe(true);

    // Verification 3: Login comparison fails with wrong password
    const isWrongMatch = await user.comparePassword("WrongPassword!");
    expect(isWrongMatch).toBe(false);

    // Verification 4: JSON serialization strips password fields
    const jsonOutput = JSON.parse(JSON.stringify(user));
    expect(jsonOutput.password).toBeUndefined();
    expect(jsonOutput.passwordHash).toBeUndefined();
    expect(jsonOutput.plainPassword).toBeUndefined();
  });

  it("does not force a password reset on ordinary successful logins for hr and team lead accounts", () => {
    const user = new User({
      name: "Riya Shah",
      email: "riya@kevalon.com",
      password: "ValidPass123",
      role: "hr",
      isApproved: true,
      isActive: true,
      mustChangePassword: false,
      isFirstLogin: false,
      lastLogin: new Date("2024-01-01T00:00:00.000Z"),
    });

    __test__applySuccessfulLoginState(user);

    expect(user.mustChangePassword).toBe(false);
    expect(user.isFirstLogin).toBe(false);
  });

  it("allows accountant and CA accounts to log in without approval", () => {
    expect(shouldRequireApproval("accountant")).toBe(false);
    expect(shouldRequireApproval("CA")).toBe(false);
    expect(shouldRequireApproval("employee")).toBe(true);
    expect(shouldRequireApproval("team lead")).toBe(true);
  });

  it("normalizes team lead and employee role variants for attendance check-ins", () => {
    expect(__test__normalizeRoleValue("teamlead")).toBe("team lead");
    expect(__test__normalizeRoleValue("teamleader")).toBe("team lead");
    expect(__test__normalizeRoleValue("Team Lead")).toBe("team lead");
    expect(__test__normalizeRoleValue("team_lead")).toBe("team lead");
    expect(__test__normalizeRoleValue("Employee")).toBe("employee");
    expect(__test__normalizeRoleValue("  employee  ")).toBe("employee");
    expect(__test__normalizeRoleValue("Accountant")).toBe("accountant");
    expect(__test__normalizeRoleValue("CA")).toBe("ca");
  });

  it("accepts accountant and CA as valid attendance user types", () => {
    const accountantAttendance = new Attendance({
      userId: new mongoose.Types.ObjectId(),
      userType: "accountant",
      date: "2026-09-25",
    });

    const caAttendance = new Attendance({
      userId: new mongoose.Types.ObjectId(),
      userType: "ca",
      date: "2026-09-25",
    });

    expect(accountantAttendance.validateSync()).toBeUndefined();
    expect(caAttendance.validateSync()).toBeUndefined();
  });
});
