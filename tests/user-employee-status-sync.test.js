const {
  __test__getEmployeeStatus,
  __test__syncEmployeeStatus,
} = require("../controllers/userControllers");

describe("user and employee active status synchronization", () => {
  it("maps an inactive user to inactive employee statuses", () => {
    expect(__test__getEmployeeStatus(false)).toEqual({
      employeeStatus: "Inactive",
      status: "INACTIVE",
    });
  });

  it("keeps active users mapped to active employee statuses", () => {
    expect(__test__getEmployeeStatus(true)).toEqual({
      employeeStatus: "Active",
      status: "ACTIVE",
    });
  });

  it("persists both inactive employee status fields together", async () => {
    const employee = {
      employeeStatus: "Active",
      status: "ACTIVE",
      save: jest.fn().mockResolvedValue(undefined),
    };

    await __test__syncEmployeeStatus(employee, false);

    expect(employee.employeeStatus).toBe("Inactive");
    expect(employee.status).toBe("INACTIVE");
    expect(employee.save).toHaveBeenCalledTimes(1);
  });
});
