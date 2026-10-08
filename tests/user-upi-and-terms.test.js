const mongoose = require("mongoose");
const User = require("../models/User");
const { buildUserResponse } = require("../controllers/userControllers");

describe("User Model & Endpoints - UPI ID, Bank Details, and Terms & Conditions", () => {
  it("stores bankDetails (bankName, bankAccountNumber, ifscCode, upiId) and termsAndConditions boolean field", () => {
    const user = new User({
      name: "UPI Terms Test User",
      email: "test-terms-upi1@example.com",
      password: "password123!",
      phoneNumber: "9876543210",
      bankName: "HDFC Bank",
      bankAccountNumber: "123456789012",
      ifscCode: "HDFC0001234",
      upiId: "testuser@hdfcbank",
      termsAndConditions: true,
    });

    expect(user.upiId).toBe("testuser@hdfcbank");
    expect(user.upiID).toBe("testuser@hdfcbank");
    expect(user.upi).toBe("testuser@hdfcbank");
    expect(user.termsAndConditions).toBe(true);
    expect(user.isTermsAccepted).toBe(true);
    expect(user.termsAndConditionsAccepted).toBe(true);
  });

  it("converts string 'true' or number 1 for termsAndConditions into boolean true", () => {
    const user1 = new User({
      name: "Terms String User",
      email: "test1@example.com",
      termsAndConditions: "true",
    });
    expect(user1.termsAndConditions).toBe(true);
    expect(user1.isTermsAccepted).toBe(true);

    const user2 = new User({
      name: "Terms Number User",
      email: "test2@example.com",
      termsAndConditions: 1,
    });
    expect(user2.termsAndConditions).toBe(true);
    expect(user2.isTermsAccepted).toBe(true);
  });

  it("includes bankDetails object, upiId, upiID, upi, and termsAndConditions in buildUserResponse", () => {
    const user = new User({
      _id: new mongoose.Types.ObjectId(),
      name: "Response Test User",
      email: "res.user@example.com",
      role: "employee",
      bankName: "ICICI Bank",
      bankAccountNumber: "987654321098",
      ifscCode: "ICIC0005678",
      upiId: "resuser@icici",
      termsAndConditions: true,
    });

    const response = buildUserResponse(user);
    expect(response.upiId).toBe("resuser@icici");
    expect(response.upiID).toBe("resuser@icici");
    expect(response.upi).toBe("resuser@icici");

    expect(response.bankName).toBe("ICICI Bank");
    expect(response.bankAccountNumber).toBe("987654321098");
    expect(response.ifscCode).toBe("ICIC0005678");

    expect(response.bankDetails).toBeDefined();
    expect(response.bankDetails.bankName).toBe("ICICI Bank");
    expect(response.bankDetails.bankAccountNumber).toBe("987654321098");
    expect(response.bankDetails.ifscCode).toBe("ICIC0005678");
    expect(response.bankDetails.upiId).toBe("resuser@icici");

    expect(response.termsAndConditions).toBe(true);
    expect(response.termsAccepted).toBe(true);
    expect(response.isTermsAccepted).toBe(true);
    expect(response.termsAndConditionsAccepted).toBe(true);
  });

  it("serializes bankDetails and termsAndConditions in toJSON and toObject transforms", () => {
    const user = new User({
      name: "Transform Test User",
      email: "transform@example.com",
      password: "Password123!",
      role: "employee",
      bankName: "State Bank of India",
      bankAccountNumber: "112233445566",
      ifscCode: "SBIN0001234",
      upiId: "transform@sbi",
      termsAndConditions: true,
    });

    const json = user.toJSON();
    expect(json.upiId).toBe("transform@sbi");
    expect(json.upiID).toBe("transform@sbi");
    expect(json.upi).toBe("transform@sbi");
    expect(json.termsAndConditions).toBe(true);
    expect(json.termsAccepted).toBe(true);
    expect(json.isTermsAccepted).toBe(true);
    expect(json.bankDetails).toBeDefined();
    expect(json.bankDetails.bankName).toBe("State Bank of India");
    expect(json.bankDetails.bankAccountNumber).toBe("112233445566");
    expect(json.bankDetails.ifscCode).toBe("SBIN0001234");
    expect(json.bankDetails.upiId).toBe("transform@sbi");
    expect(json.password).toBeUndefined();

    const obj = user.toObject();
    expect(obj.upiId).toBe("transform@sbi");
    expect(obj.termsAndConditions).toBe(true);
    expect(obj.bankDetails.bankName).toBe("State Bank of India");
  });
});
