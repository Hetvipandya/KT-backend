const mongoose = require("mongoose");
const MonthlySalary = require("../models/MonthlySalary");
const { updateMonthlySalary } = require("../controllers/monthlySalaryController");

describe("Monthly salary update API", () => {
  let salary;
  let res;

  beforeEach(() => {
    salary = {
      _id: new mongoose.Types.ObjectId(),
      status: "Generated",
      basicSalary: 8000,
      hra: 1020,
      conveyanceAllowance: 0,
      medicalAllowance: 0,
      specialAllowance: 0,
      allowance: 0,
      dearnessAllowance: 0,
      otherAllowances: 0,
      fixedBonus: 0,
      extraBonus: 0,
      pfDeduction: 960,
      esicDeduction: 68,
      professionalTax: 0,
      tds: 0,
      fixedDeduction: 0,
      extraDeduction: 0,
      otherDeductions: 0,
      totalDays: 30,
      lopDays: 0,
      grossSalary: 9020,
      totalDeduction: 1028,
      netSalary: 7992,
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.restoreAllMocks();
  });

  test("persists supported fields from a data-wrapped request and recalculates totals", async () => {
    jest.spyOn(MonthlySalary, "findById")
      .mockResolvedValueOnce(salary)
      .mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(salary),
      });

    await updateMonthlySalary(
      {
        params: { id: salary._id.toString() },
        body: { data: { basicSalary: 10000, pfDeduction: 1200, lopDays: 1 } },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(salary.save).toHaveBeenCalledTimes(1);
    expect(salary.basicSalary).toBe(10000);
    expect(salary.grossSalary).toBe(11020);
    expect(salary.perDaySalary).toBe(367.33);
    expect(salary.lopDeduction).toBe(367.33);
    expect(salary.totalDeduction).toBe(1635.33);
    expect(salary.netSalary).toBe(9384.67);
    expect(res.json.mock.calls[0][0].data.basicSalary).toBe(10000);
  });

  test("does not report success when the request has no supported fields", async () => {
    jest.spyOn(MonthlySalary, "findById").mockResolvedValue(salary);

    await updateMonthlySalary(
      {
        params: { id: salary._id.toString() },
        body: { unexpectedField: 500 },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(salary.save).not.toHaveBeenCalled();
  });
});
