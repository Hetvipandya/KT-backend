const mongoose = require("mongoose");
const User = require("../models/User");
const { buildUserResponse } = require("../controllers/userControllers");

describe("User UPI ID Field Validation and Storage", () => {
  it("allows creating a User without upiId (optional, required: false)", () => {
    const user = new User({
      name: "Bhavya Shah",
      email: "bhavya.shah@example.com",
      password: "Password123!",
      role: "employee",
    });

    const validationError = user.validateSync();
    expect(validationError).toBeUndefined();
    expect(user.upiId).toBeNull();
  });

  it("stores upiId correctly when provided", () => {
    const user = new User({
      name: "Bhavya Shah",
      email: "bhavya.shah@example.com",
      password: "Password123!",
      role: "team lead",
      upiId: "bhavya@okhdfcbank",
    });

    expect(user.upiId).toBe("bhavya@okhdfcbank");
    expect(user.upiID).toBe("bhavya@okhdfcbank");
  });

  it("trims whitespace around upiId", () => {
    const user = new User({
      name: "Bhavya Shah",
      email: "bhavya.shah@example.com",
      password: "Password123!",
      role: "employee",
      upiId: "   bhavya@upi   ",
    });

    expect(user.upiId).toBe("bhavya@upi");
  });

  it("sets empty string or undefined upiId to null", () => {
    const user1 = new User({
      name: "Bhavya Shah",
      email: "bhavya.shah1@example.com",
      password: "Password123!",
      role: "employee",
      upiId: "",
    });
    expect(user1.upiId).toBeNull();

    const user2 = new User({
      name: "Bhavya Shah",
      email: "bhavya.shah2@example.com",
      password: "Password123!",
      role: "employee",
      upiId: null,
    });
    expect(user2.upiId).toBeNull();
  });

  it("supports virtual property upiID for getter and setter", () => {
    const user = new User({
      name: "Bhavya Shah",
      email: "bhavya.shah@example.com",
      password: "Password123!",
      role: "employee",
    });

    user.upiID = "bhavya.lead@okicici";
    expect(user.upiId).toBe("bhavya.lead@okicici");
    expect(user.upiID).toBe("bhavya.lead@okicici");
  });

  it("includes upiId in buildUserResponse", () => {
    const user = new User({
      _id: new mongoose.Types.ObjectId(),
      name: "Bhavya Shah",
      email: "bhavya.shah@example.com",
      role: "team lead",
      upiId: "bhavya@oksbi",
      bankAccountNumber: "123456789012",
      ifscCode: "SBIN0005943",
    });

    const response = buildUserResponse(user);
    expect(response.upiId).toBe("bhavya@oksbi");
    expect(response.upiID).toBe("bhavya@oksbi");
    expect(response.upi).toBe("bhavya@oksbi");
    expect(response.bankAccountNumber).toBe("123456789012");
    expect(response.ifscCode).toBe("SBIN0005943");
  });

  it("serializes upiId and upiID in toJSON and toObject transforms", () => {
    const user = new User({
      name: "Bhavya Shah",
      email: "bhavya.shah@example.com",
      password: "Password123!",
      role: "team lead",
      upiId: "bhavya@paytm",
    });

    const json = user.toJSON();
    expect(json.upiId).toBe("bhavya@paytm");
    expect(json.upiID).toBe("bhavya@paytm");
    expect(json.password).toBeUndefined();

    const obj = user.toObject();
    expect(obj.upiId).toBe("bhavya@paytm");
    expect(obj.upiID).toBe("bhavya@paytm");
  });
});
