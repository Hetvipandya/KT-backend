const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const Branch = require("../models/Branch");
const Company = require("../models/Company");
const MonthlySalary = require("../models/MonthlySalary");
const BankAccount = require("../models/BankAccount");
const bankAccountService = require("../services/bankAccount.service");
const monthlySalaryRoutes = require("../routes/monthlySalaryRoutes");
const {
  getFinancePayrollRegister,
  payFinanceMonthlySalary,
} = require("../controllers/monthlySalaryController");

const adminId = new mongoose.Types.ObjectId();
const companyId = new mongoose.Types.ObjectId();
const branchId = new mongoose.Types.ObjectId();
let requestRole = "admin";
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { _id: adminId, role: requestRole, companyId };
  next();
});
app.use("/api/salaries", monthlySalaryRoutes);

const createResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
};

describe("Finance monthly payroll register", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    requestRole = "admin";
  });

  it("lists payroll for only the requested company, branch, month, and year", async () => {
    const companyId = new mongoose.Types.ObjectId().toString();
    const branchId = new mongoose.Types.ObjectId().toString();
    const salaries = [{ _id: new mongoose.Types.ObjectId(), month: 10, year: 2026 }];
    const query = {
      populate: jest.fn(),
      sort: jest.fn().mockResolvedValue(salaries),
    };
    query.populate.mockReturnValue(query);
    const find = jest.spyOn(MonthlySalary, "find").mockReturnValue(query);
    const res = createResponse();

    await getFinancePayrollRegister({
      query: { companyId, branchId, month: "10", year: "2026" },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBe(salaries);
    expect(find).toHaveBeenCalledWith({ companyId, branchId, month: 10, year: 2026 });
    expect(query.populate).toHaveBeenCalledWith(
      "employeeId",
      expect.stringContaining("bankAccountNumber")
    );
    expect(query.populate).toHaveBeenCalledWith(
      "employeeId",
      expect.stringContaining("phoneNumber")
    );
    expect(query.populate).toHaveBeenCalledWith(
      "userId",
      expect.stringContaining("ifscCode")
    );
    expect(query.populate).toHaveBeenCalledWith(
      "customDeductionsList.deductionMasterId",
      expect.stringContaining("description")
    );
    expect(query.populate).toHaveBeenCalledWith(
      "generatedBy approvedBy paidBy",
      "name email"
    );
    expect(query.populate).toHaveBeenCalledWith(
      "paidFromAccountId",
      "accountName bankName accountType"
    );
  });

  it("lists all payroll periods when month and year are omitted", async () => {
    const companyId = new mongoose.Types.ObjectId().toString();
    const branchId = new mongoose.Types.ObjectId().toString();
    const salaries = [
      { _id: new mongoose.Types.ObjectId(), month: 10, year: 2026 },
      { _id: new mongoose.Types.ObjectId(), month: 11, year: 2026 },
    ];
    const query = {
      populate: jest.fn(),
      sort: jest.fn().mockResolvedValue(salaries),
    };
    query.populate.mockReturnValue(query);
    const find = jest.spyOn(MonthlySalary, "find").mockReturnValue(query);
    const res = createResponse();

    await getFinancePayrollRegister({ query: { companyId, branchId } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBe(salaries);
    expect(find).toHaveBeenCalledWith({ companyId, branchId });
  });

  it("rejects invalid payroll periods without querying salary records", async () => {
    const find = jest.spyOn(MonthlySalary, "find");
    const res = createResponse();

    await getFinancePayrollRegister({
      query: {
        companyId: new mongoose.Types.ObjectId().toString(),
        branchId: new mongoose.Types.ObjectId().toString(),
        month: "13",
        year: "2026",
      },
    }, res);

    expect(res.statusCode).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before marking a salary paid", async () => {
    const findOne = jest.spyOn(MonthlySalary, "findOne");
    const res = createResponse();

    await payFinanceMonthlySalary({
      body: {
        salaryId: new mongoose.Types.ObjectId().toString(),
        companyId: new mongoose.Types.ObjectId().toString(),
        branchId: new mongoose.Types.ObjectId().toString(),
        paymentMode: "BANK_TRANSFER",
        transferConfirmed: false,
      },
    }, res);

    expect(res.statusCode).toBe(400);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("records a confirmed cash payment without requiring bank details", async () => {
    const salaryId = new mongoose.Types.ObjectId();
    const employeeId = new mongoose.Types.ObjectId();
    const paidFromAccountId = new mongoose.Types.ObjectId();
    const salary = {
      _id: salaryId,
      companyId,
      branchId,
      employeeId,
      userId: employeeId,
      status: "Generated",
      netSalary: 45000,
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(MonthlySalary, "findOne").mockResolvedValue(salary);
    jest.spyOn(MonthlySalary, "findById").mockResolvedValue(salary);
    jest.spyOn(BankAccount, "findOne").mockResolvedValue({
      _id: paidFromAccountId,
      accountName: "Office cash",
      accountType: "Cash",
      coaAccountId: new mongoose.Types.ObjectId(),
    });
    jest.spyOn(bankAccountService, "getAccountBalance").mockResolvedValue(50000);
    const findUser = jest.spyOn(require("../models/User"), "findById");
    const res = createResponse();

    await payFinanceMonthlySalary({
      body: {
        salaryId: salaryId.toString(),
        companyId: companyId.toString(),
        branchId: branchId.toString(),
        paymentMode: "CASH",
        paidFromAccountId: paidFromAccountId.toString(),
        transferConfirmed: true,
        remarks: "Cash salary payment confirmed.",
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(salary.status).toBe("Paid");
    expect(salary.paymentMode).toBe("CASH");
    expect(salary.paidFromAccountId).toEqual(paidFromAccountId.toString());
    expect(salary.save).toHaveBeenCalledTimes(1);
    expect(findUser).not.toHaveBeenCalled();
  });

  it("records a confirmed UPI payment with its payment type and employee UPI ID", async () => {
    const salaryId = new mongoose.Types.ObjectId();
    const employeeId = new mongoose.Types.ObjectId();
    const paidFromAccountId = new mongoose.Types.ObjectId();
    const salary = {
      _id: salaryId,
      companyId,
      branchId,
      employeeId,
      userId: employeeId,
      status: "Generated",
      netSalary: 45000,
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(MonthlySalary, "findOne").mockResolvedValue(salary);
    jest.spyOn(MonthlySalary, "findById").mockResolvedValue(salary);
    jest.spyOn(BankAccount, "findOne").mockResolvedValue({
      _id: paidFromAccountId,
      accountName: "Payroll Bank",
      accountType: "Savings",
      coaAccountId: new mongoose.Types.ObjectId(),
    });
    jest.spyOn(bankAccountService, "getAccountBalance").mockResolvedValue(50000);
    jest.spyOn(require("../models/User"), "findById").mockResolvedValue({
      _id: employeeId,
      name: "Employee",
      upiId: "employee@upi",
    });
    const res = createResponse();

    await payFinanceMonthlySalary({
      body: {
        salaryId: salaryId.toString(),
        companyId: companyId.toString(),
        branchId: branchId.toString(),
        paymentMode: "UPI",
        paymentType: "PHONEPE",
        paidFromAccountId: paidFromAccountId.toString(),
        transferConfirmed: true,
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(salary.status).toBe("Paid");
    expect(salary.paymentMode).toBe("UPI");
    expect(salary.paymentType).toBe("PHONEPE");
    expect(salary.paidFromAccountId).toBe(paidFromAccountId.toString());
    expect(salary.save).toHaveBeenCalledTimes(1);
  });

  it("rejects salary payment when the selected company account has insufficient funds", async () => {
    const salaryId = new mongoose.Types.ObjectId();
    const employeeId = new mongoose.Types.ObjectId();
    const paidFromAccountId = new mongoose.Types.ObjectId();
    const salary = {
      _id: salaryId,
      companyId,
      branchId,
      employeeId,
      userId: employeeId,
      status: "Generated",
      netSalary: 45000,
      save: jest.fn(),
    };
    jest.spyOn(MonthlySalary, "findOne").mockResolvedValue(salary);
    jest.spyOn(BankAccount, "findOne").mockResolvedValue({
      _id: paidFromAccountId,
      accountName: "Payroll Bank",
      accountType: "Savings",
      coaAccountId: new mongoose.Types.ObjectId(),
    });
    jest.spyOn(bankAccountService, "getAccountBalance").mockResolvedValue(200);
    const res = createResponse();

    await payFinanceMonthlySalary({
      body: {
        salaryId: salaryId.toString(),
        companyId: companyId.toString(),
        branchId: branchId.toString(),
        paymentMode: "BANK_TRANSFER",
        paidFromAccountId: paidFromAccountId.toString(),
        transferConfirmed: true,
      },
    }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/insufficient funds/i);
    expect(salary.save).not.toHaveBeenCalled();
  });

  it("prevents recording payment twice for a salary already paid", async () => {
    const salaryId = new mongoose.Types.ObjectId();
    const companyId = new mongoose.Types.ObjectId().toString();
    const branchId = new mongoose.Types.ObjectId().toString();
    const findOne = jest.spyOn(MonthlySalary, "findOne").mockResolvedValue({
      _id: salaryId,
      companyId,
      branchId,
      status: "Paid",
      netSalary: 45000,
    });

    const res = createResponse();

    await payFinanceMonthlySalary({
      body: {
        salaryId: salaryId.toString(),
        companyId,
        branchId,
        paymentMode: "BANK_TRANSFER",
        paidFromAccountId: new mongoose.Types.ObjectId().toString(),
        transferConfirmed: true,
      },
    }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/already been paid/i);
    expect(findOne).toHaveBeenCalledWith({
      _id: salaryId.toString(),
      companyId,
      branchId,
    });
  });

  it("requires the employee's bank account and IFSC before recording payment", async () => {
    const salaryId = new mongoose.Types.ObjectId();
    const employeeId = new mongoose.Types.ObjectId();
    const paidFromAccountId = new mongoose.Types.ObjectId();
    const findOne = jest.spyOn(MonthlySalary, "findOne").mockResolvedValue({
      _id: salaryId,
      companyId,
      branchId,
      employeeId,
      userId: employeeId,
      status: "Generated",
      netSalary: 45000,
      save: jest.fn(),
    });
    jest.spyOn(BankAccount, "findOne").mockResolvedValue({
      _id: paidFromAccountId,
      accountName: "Payroll Bank",
      accountType: "Savings",
      coaAccountId: new mongoose.Types.ObjectId(),
    });
    jest.spyOn(bankAccountService, "getAccountBalance").mockResolvedValue(50000);
    jest.spyOn(require("../models/User"), "findById").mockResolvedValue({
      _id: employeeId,
      name: "Employee",
      bankAccountNumber: null,
      ifscCode: null,
    });
    const res = createResponse();

    await payFinanceMonthlySalary({
      body: {
        salaryId: salaryId.toString(),
        companyId: companyId.toString(),
        branchId: branchId.toString(),
        paymentMode: "BANK_TRANSFER",
        paidFromAccountId: paidFromAccountId.toString(),
        transferConfirmed: true,
      },
    }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/bank account number and IFSC/i);
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it("serves the protected finance register route before the generic salary-id route", async () => {
    jest.spyOn(Company, "findById").mockResolvedValue({
      _id: companyId,
      createdBy: adminId,
    });
    jest.spyOn(Branch, "findOne").mockResolvedValue({
      _id: branchId,
      companyId,
    });
    const salaries = [{ _id: new mongoose.Types.ObjectId(), month: 11, year: 2026 }];
    const query = {
      populate: jest.fn(),
      sort: jest.fn().mockResolvedValue(salaries),
    };
    query.populate.mockReturnValue(query);
    jest.spyOn(MonthlySalary, "find").mockReturnValue(query);

    const response = await request(app)
      .get("/api/salaries/finance-register")
      .query({
        companyId: companyId.toString(),
        branchId: branchId.toString(),
        month: 11,
        year: 2026,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });

  it("routes finance payment confirmations through the explicit-confirmation handler", async () => {
    jest.spyOn(Company, "findById").mockResolvedValue({
      _id: companyId,
      createdBy: adminId,
    });
    jest.spyOn(Branch, "findOne").mockResolvedValue({
      _id: branchId,
      companyId,
    });
    const findOne = jest.spyOn(MonthlySalary, "findOne");

    const response = await request(app)
      .put("/api/salaries/finance-register/pay")
      .send({
        salaryId: new mongoose.Types.ObjectId().toString(),
        companyId: companyId.toString(),
        branchId: branchId.toString(),
        paymentMode: "BANK_TRANSFER",
        transferConfirmed: false,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/confirm the completed payment/i);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("does not expose the finance payroll register to employees", async () => {
    requestRole = "employee";
    const response = await request(app)
      .get("/api/salaries/finance-register")
      .query({
        companyId: companyId.toString(),
        branchId: branchId.toString(),
        month: 11,
        year: 2026,
      });

    expect(response.status).toBe(403);
  });
});
