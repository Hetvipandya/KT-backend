const sanitizeUserUpdatePayload = require("../utils/userPayloadSanitizer");
const User = require("../models/User");
const {
  buildLoginLookupQuery,
  __test__applyPasswordUpdate,
} = require("../controllers/userControllers");

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

  it("retains the updated password in the compatibility plaintext field after a password update", () => {
    const user = new User({
      name: "Amit Patel",
      email: "amit@example.com",
      password: "OldPass123",
      plainPassword: "OldPass123",
      role: "employee",
    });

    __test__applyPasswordUpdate(user, "NewPass456");

    expect(user.password).toBe("NewPass456");
    expect(user.plainPassword).toBe("NewPass456");
  });
});
