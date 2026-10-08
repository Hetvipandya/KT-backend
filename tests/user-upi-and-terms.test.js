const mongoose = require("mongoose");
const User = require("../models/User");
const { buildUserResponse } = require("../controllers/userControllers");

describe("User Model & Endpoints - UPI ID, Bank Details, and Terms & Conditions", () => {
  it("stores bankDetails (bankName, bankAccountNumber, ifscCode, upiId), isBankDetailGiven, and termsAndConditions boolean field", () => {
    const user = new User({
      name: "UPI Terms Test User",
      email: "test-terms-upi1@example.com",
      password: "password123!",
      phoneNumber: "9876543210",
      bankName: "HDFC Bank",
      bankAccountNumber: "123456789012",
      ifscCode: "HDFC0001234",
      upiId: "testuser@hdfcbank",
      isBankDetailGiven: true,
      termsAndConditions: true,
    });

    expect(user.upiId).toBe("testuser@hdfcbank");
    expect(user.upiID).toBe("testuser@hdfcbank");
    expect(user.upi).toBe("testuser@hdfcbank");
    expect(user.isBankDetailGiven).toBe(true);
    expect(user.bankDetailGiven).toBe(true);
    expect(user.bankDetailsGiven).toBe(true);
    expect(user.isBankDetailsGiven).toBe(true);
    expect(user.termsAndConditions).toBe(true);
    expect(user.isTermsAccepted).toBe(true);
    expect(user.termsAndConditionsAccepted).toBe(true);
  });

  it("defaults isBankDetailGiven to false when no bank info is provided", () => {
    const user = new User({
      name: "No Bank User",
      email: "nobank@example.com",
    });
    expect(user.isBankDetailGiven).toBe(false);
    expect(user.bankDetailGiven).toBe(false);
    expect(user.bankDetailsGiven).toBe(false);
    expect(user.isBankDetailsGiven).toBe(false);
  });

  it("converts string 'true' or number 1 for termsAndConditions and bankDetailGiven into boolean true", () => {
    const user1 = new User({
      name: "Terms String User",
      email: "test1@example.com",
      bankDetailGiven: "true",
      termsAndConditions: "true",
    });
    expect(user1.bankDetailGiven).toBe(true);
    expect(user1.isBankDetailGiven).toBe(true);
    expect(user1.termsAndConditions).toBe(true);
    expect(user1.isTermsAccepted).toBe(true);

    const user2 = new User({
      name: "Terms Number User",
      email: "test2@example.com",
      isBankDetailGiven: 1,
      termsAndConditions: 1,
    });
    expect(user2.isBankDetailGiven).toBe(true);
    expect(user2.bankDetailGiven).toBe(true);
    expect(user2.termsAndConditions).toBe(true);
    expect(user2.isTermsAccepted).toBe(true);
  });

  it("includes bankDetails object, upiId, upiID, upi, isBankDetailGiven, and termsAndConditions in buildUserResponse", () => {
    const user = new User({
      _id: new mongoose.Types.ObjectId(),
      name: "Response Test User",
      email: "res.user@example.com",
      role: "employee",
      bankName: "ICICI Bank",
      bankAccountNumber: "987654321098",
      ifscCode: "ICIC0005678",
      upiId: "resuser@icici",
      isBankDetailGiven: true,
      termsAndConditions: true,
    });

    const response = buildUserResponse(user);
    expect(response.upiId).toBe("resuser@icici");
    expect(response.upiID).toBe("resuser@icici");
    expect(response.upi).toBe("resuser@icici");

    expect(response.bankName).toBe("ICICI Bank");
    expect(response.bankAccountNumber).toBe("987654321098");
    expect(response.ifscCode).toBe("ICIC0005678");

    expect(response.isBankDetailGiven).toBe(true);
    expect(response.bankDetailGiven).toBe(true);
    expect(response.bankDetailsGiven).toBe(true);
    expect(response.isBankDetailsGiven).toBe(true);

    expect(response.bankDetails).toBeDefined();
    expect(response.bankDetails.bankName).toBe("ICICI Bank");
    expect(response.bankDetails.bankAccountNumber).toBe("987654321098");
    expect(response.bankDetails.ifscCode).toBe("ICIC0005678");
    expect(response.bankDetails.upiId).toBe("resuser@icici");
    expect(response.bankDetails.isBankDetailGiven).toBe(true);
    expect(response.bankDetails.bankDetailGiven).toBe(true);

    expect(response.termsAndConditions).toBe(true);
    expect(response.termsAccepted).toBe(true);
    expect(response.isTermsAccepted).toBe(true);
    expect(response.termsAndConditionsAccepted).toBe(true);
  });

  it("serializes bankDetails, isBankDetailGiven, and termsAndConditions in toJSON and toObject transforms", () => {
    const user = new User({
      name: "Transform Test User",
      email: "transform@example.com",
      password: "Password123!",
      role: "employee",
      bankName: "State Bank of India",
      bankAccountNumber: "112233445566",
      ifscCode: "SBIN0001234",
      upiId: "transform@sbi",
      isBankDetailGiven: true,
      termsAndConditions: true,
    });

    const json = user.toJSON();
    expect(json.upiId).toBe("transform@sbi");
    expect(json.upiID).toBe("transform@sbi");
    expect(json.upi).toBe("transform@sbi");
    expect(json.isBankDetailGiven).toBe(true);
    expect(json.bankDetailGiven).toBe(true);
    expect(json.termsAndConditions).toBe(true);
    expect(json.termsAccepted).toBe(true);
    expect(json.isTermsAccepted).toBe(true);
    expect(json.bankDetails).toBeDefined();
    expect(json.bankDetails.bankName).toBe("State Bank of India");
    expect(json.bankDetails.bankAccountNumber).toBe("112233445566");
    expect(json.bankDetails.ifscCode).toBe("SBIN0001234");
    expect(json.bankDetails.upiId).toBe("transform@sbi");
    expect(json.bankDetails.isBankDetailGiven).toBe(true);
    expect(json.password).toBeUndefined();

    const obj = user.toObject();
    expect(obj.upiId).toBe("transform@sbi");
    expect(obj.isBankDetailGiven).toBe(true);
    expect(obj.termsAndConditions).toBe(true);
    expect(obj.bankDetails.bankName).toBe("State Bank of India");
  });
});
