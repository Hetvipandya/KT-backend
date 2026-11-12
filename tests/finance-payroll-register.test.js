const mongoose = require("mongoose");
const MonthlySalary = require("../models/MonthlySalary");
const {
  getFinancePayrollRegister,
  payFinanceMonthlySalary,
} = require("../controllers/monthlySalaryController");

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
      "userId",
      expect.stringContaining("ifscCode")
    );
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

  it("prevents recording payment twice for a salary already paid", async () => {
    const salaryId = new mongoose.Types.ObjectId();
    const companyId = new mongoose.Types.ObjectId().toString();
    const branchId = new mongoose.Types.ObjectId().toString();
    const findOne = jest.spyOn(MonthlySalary, "findOne").mockResolvedValue({
      _id: salaryId,
      companyId,
      branchId,
      status: "Paid",
    });
    const res = createResponse();

    await payFinanceMonthlySalary({
      body: {
        salaryId: salaryId.toString(),
        companyId,
        branchId,
        paymentMode: "BANK_TRANSFER",
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
});
