const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

const MonthlySalary = require("../models/MonthlySalary");
const User = require("../models/User");
const Employee = require("../models/Employee");
const monthlySalaryRoutes = require("../routes/monthlySalaryRoutes");

describe("Salary Pay API - Support for employeeId in addition to MongoDB Salary ID", () => {
  let app;
  let testUserId;
  let testEmployeeDocId;
  let salaryId;
  let mockUser;
  let mockEmployee;
  let mockSalaryDoc;

  beforeAll(() => {
    testUserId = new mongoose.Types.ObjectId();
    testEmployeeDocId = new mongoose.Types.ObjectId();
    salaryId = new mongoose.Types.ObjectId();

    mockUser = {
      _id: testUserId,
      name: "Bhavya Shah",
      email: "bhavya.shah@example.com",
      role: "employee",
      uniqueID: "EMP-007",
    };

    mockEmployee = {
      _id: testEmployeeDocId,
      userID: testUserId,
      userId: testUserId,
      employeeID: "EMP-007",
      employeeCode: "EMP-007",
    };

    mockSalaryDoc = {
      _id: salaryId,
      employeeId: testUserId,
      userId: testUserId,
      month: 9,
      year: 2026,
      salaryMonth: "September 2026",
      netSalary: 45000,
      status: "Approved",
      paymentMode: "BANK_TRANSFER",
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
      toObject: function () {
        return { ...this };
      },
    };

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { _id: new mongoose.Types.ObjectId(), role: "admin", name: "Admin" };
      next();
    });
    app.use("/api/salaries", monthlySalaryRoutes);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    mockSalaryDoc.status = "Approved";
    mockSalaryDoc.save.mockClear();
  });

  it("1. Marks salary as Paid using salary._id in URL params (/api/salaries/:salaryId/pay)", async () => {
    jest.spyOn(MonthlySalary, "findById").mockImplementation((id) => {
      if (id.toString() === salaryId.toString()) {
        return {
          populate: jest.fn().mockReturnThis(),
          then: (resolve) => resolve(mockSalaryDoc),
        };
      }
      return {
        populate: jest.fn().mockReturnThis(),
        then: (resolve) => resolve(null),
      };
    });

    const res = await request(app)
      .post(`/api/salaries/${salaryId}/pay`)
      .send({ paymentMode: "BANK_TRANSFER", remarks: "Disbursed via bank" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSalaryDoc.status).toBe("Paid");
    expect(mockSalaryDoc.remarks).toBe("Disbursed via bank");
  });

  it("2. Marks salary as Paid using employee User._id in URL params (/api/salaries/:employeeId/pay)", async () => {
    // When queried with employee User._id, MonthlySalary.findById returns null, so it falls back to resolveSalaryRecord
    jest.spyOn(MonthlySalary, "findById").mockImplementation((id) => {
      if (id.toString() === salaryId.toString()) {
        return {
          populate: jest.fn().mockReturnThis(),
          then: (resolve) => resolve(mockSalaryDoc),
        };
      }
      return Promise.resolve(null);
    });

    jest.spyOn(User, "findById").mockResolvedValue(mockUser);
    jest.spyOn(MonthlySalary, "findOne").mockImplementation(() => {
      return {
        sort: jest.fn().mockResolvedValue(mockSalaryDoc),
      };
    });

    const res = await request(app)
      .post(`/api/salaries/${testUserId}/pay`)
      .send({ paymentMode: "UPI", remarks: "Disbursed via UPI" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSalaryDoc.status).toBe("Paid");
    expect(mockSalaryDoc.paymentMode).toBe("UPI");
  });

  it("3. Marks salary as Paid using Employee collection _id in URL params", async () => {
    jest.spyOn(MonthlySalary, "findById").mockImplementation((id) => {
      if (id.toString() === salaryId.toString()) {
        return {
          populate: jest.fn().mockReturnThis(),
          then: (resolve) => resolve(mockSalaryDoc),
        };
      }
      return Promise.resolve(null);
    });

    jest.spyOn(User, "findById").mockResolvedValue(null);
    jest.spyOn(Employee, "findById").mockResolvedValue(mockEmployee);
    jest.spyOn(MonthlySalary, "findOne").mockImplementation(() => {
      return {
        sort: jest.fn().mockResolvedValue(mockSalaryDoc),
      };
    });

    const res = await request(app)
      .post(`/api/salaries/${testEmployeeDocId}/pay`)
      .send({ paymentMode: "BANK_TRANSFER" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSalaryDoc.status).toBe("Paid");
  });

  it("4. Marks salary as Paid using employee code string (EMP-007) in URL params", async () => {
    jest.spyOn(MonthlySalary, "findById").mockImplementation((id) => {
      if (id.toString() === salaryId.toString()) {
        return {
          populate: jest.fn().mockReturnThis(),
          then: (resolve) => resolve(mockSalaryDoc),
        };
      }
      return Promise.resolve(null);
    });

    jest.spyOn(User, "findOne").mockResolvedValue(mockUser);
    jest.spyOn(MonthlySalary, "findOne").mockImplementation(() => {
      return {
        sort: jest.fn().mockResolvedValue(mockSalaryDoc),
      };
    });

    const res = await request(app)
      .post("/api/salaries/EMP-007/pay")
      .send({ paymentMode: "BANK_TRANSFER" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSalaryDoc.status).toBe("Paid");
  });

  it("5. Marks salary as Paid using POST /api/salaries/pay with employeeId in body", async () => {
    jest.spyOn(MonthlySalary, "findById").mockImplementation((id) => {
      if (id.toString() === salaryId.toString()) {
        return {
          populate: jest.fn().mockReturnThis(),
          then: (resolve) => resolve(mockSalaryDoc),
        };
      }
      return Promise.resolve(null);
    });

    jest.spyOn(User, "findById").mockResolvedValue(mockUser);
    jest.spyOn(MonthlySalary, "findOne").mockImplementation(() => {
      return {
        sort: jest.fn().mockResolvedValue(mockSalaryDoc),
      };
    });

    const res = await request(app)
      .post("/api/salaries/pay")
      .send({
        employeeId: testUserId.toString(),
        month: 9,
        year: 2026,
        paymentMode: "BANK_TRANSFER",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSalaryDoc.status).toBe("Paid");
  });

  it("6. Returns 404 when no salary is found for a given employeeId", async () => {
    jest.spyOn(MonthlySalary, "findById").mockResolvedValue(null);
    jest.spyOn(User, "findById").mockResolvedValue(null);
    jest.spyOn(Employee, "findById").mockResolvedValue(null);
    jest.spyOn(MonthlySalary, "findOne").mockImplementation(() => {
      return {
        sort: jest.fn().mockResolvedValue(null),
      };
    });

    const unknownId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/salaries/${unknownId}/pay`)
      .send({ paymentMode: "BANK_TRANSFER" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Monthly salary record not found");
  });

  it("7. Marks salary as Paid via PUT /api/salaries/:employeeId/pay with CASH payment mode", async () => {
    jest.spyOn(MonthlySalary, "findById").mockImplementation((id) => {
      if (id.toString() === salaryId.toString()) {
        return {
          populate: jest.fn().mockReturnThis(),
          then: (resolve) => resolve(mockSalaryDoc),
        };
      }
      return Promise.resolve(null);
    });

    jest.spyOn(User, "findById").mockResolvedValue(mockUser);
    jest.spyOn(MonthlySalary, "findOne").mockImplementation(() => {
      return {
        sort: jest.fn().mockResolvedValue(mockSalaryDoc),
      };
    });

    const res = await request(app)
      .put(`/api/salaries/${testUserId}/pay`)
      .send({
        paymentMode: "CASH",
        paidAt: "2026-10-08T10:30:00.000Z",
        remarks: "Salary paid in cash",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSalaryDoc.status).toBe("Paid");
    expect(mockSalaryDoc.paymentMode).toBe("CASH");
    expect(mockSalaryDoc.remarks).toBe("Salary paid in cash");
  });

  it("8. Automatically generates and pays salary if no record pre-existed for the employee", async () => {
    const SalaryStructure = require("../models/SalaryStructure");

    jest.spyOn(MonthlySalary, "findById").mockResolvedValue(null);
    jest.spyOn(MonthlySalary, "findOne").mockImplementation(() => {
      return {
        sort: jest.fn().mockResolvedValue(null),
      };
    });

    jest.spyOn(User, "findById").mockResolvedValue(mockUser);
    jest.spyOn(SalaryStructure, "findOne").mockImplementation(() => ({
      basicSalary: 30000,
      hra: 10000,
      grossSalary: 40000,
      netSalary: 36000,
      toObject: () => ({ basicSalary: 30000, hra: 10000 }),
      sort: jest.fn().mockReturnThis(),
    }));

    const newlyCreatedSalary = {
      ...mockSalaryDoc,
      _id: new mongoose.Types.ObjectId(),
      status: "Generated",
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
    };

    jest.spyOn(MonthlySalary, "create").mockResolvedValue(newlyCreatedSalary);

    const res = await request(app)
      .put(`/api/salaries/${testUserId}/pay`)
      .send({
        paymentMode: "CASH",
        remarks: "First time salary payment",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(newlyCreatedSalary.status).toBe("Paid");
    expect(newlyCreatedSalary.paymentMode).toBe("CASH");
  });
});
