const FinanceUser = require("../models/FinanceUser");
const User = require("../models/User");
const Employee = require("../models/Employee");
const { revokeAccess } = require("../controllers/user.controller");

describe("revokeAccess status synchronization", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("marks the user and employee inactive when company access is revoked", async () => {
    const companyId = "company-id";
    const targetUserId = "user-id";
    const financeUser = {
      companyAccess: [{ companyId, isActive: true }],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const user = {
      isActive: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const employee = {
      employeeStatus: "Active",
      status: "ACTIVE",
      save: jest.fn().mockResolvedValue(undefined),
    };
    const exec = jest.fn().mockResolvedValue(financeUser);
    jest.spyOn(FinanceUser, "findOne").mockReturnValue({
      populate: jest.fn().mockReturnValue({ exec }),
    });
    jest.spyOn(User, "findById").mockResolvedValue(user);
    jest.spyOn(Employee, "findOne").mockResolvedValue(employee);

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await revokeAccess(
      {
        query: { companyId },
        params: { id: targetUserId },
        user: { _id: "admin-id" },
      },
      res,
      next,
    );

    expect(financeUser.companyAccess[0].isActive).toBe(false);
    expect(user.isActive).toBe(false);
    expect(employee.employeeStatus).toBe("Inactive");
    expect(employee.status).toBe("INACTIVE");
    expect(financeUser.save).toHaveBeenCalledTimes(1);
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(employee.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
