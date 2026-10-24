const {
  buildUserResponse,
  __test__getEmployeeStatus,
  __test__syncEmployeeStatus,
} = require("../controllers/userControllers");
const User = require("../models/User");
const {
  syncEmployeeActiveStatus,
  syncEmployeeToUser,
} = require("../utils/userEmployeeSync");

describe("user and employee active status synchronization", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it("returns a persisted rejection status in user responses", () => {
    expect(
      buildUserResponse({
        _id: "user-id",
        isApproved: false,
        isActive: false,
        status: "rejected",
      }).status,
    ).toBe("rejected");
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

  it("deactivates the linked user when the employee is inactive", async () => {
    const user = {
      isActive: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(User, "findById").mockResolvedValue(user);

    await syncEmployeeActiveStatus({
      userID: "user-id",
      employeeStatus: "Inactive",
      status: "INACTIVE",
    });

    expect(user.isActive).toBe(false);
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  it("marks the employee inactive when the linked user is inactive", async () => {
    const employee = {
      userID: "user-id",
      employeeStatus: "Active",
      status: "ACTIVE",
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(User, "findById").mockResolvedValue({ isActive: false });

    await syncEmployeeActiveStatus(employee);

    expect(employee.employeeStatus).toBe("Inactive");
    expect(employee.status).toBe("INACTIVE");
    expect(employee.save).toHaveBeenCalledTimes(1);
  });

  it("does not reactivate an inactive employee during employee-to-user sync", async () => {
    const user = {
      role: "employee",
      designation: "Employee",
      passwordHash: "existing-password-hash",
      isActive: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(User, "findById").mockResolvedValue(user);
    jest.spyOn(User, "findByIdAndUpdate").mockResolvedValue(user);

    await syncEmployeeToUser({
      employee: {
        _id: "employee-id",
        userID: "user-id",
        firstName: "Test",
        lastName: "Employee",
        email: "employee@example.com",
        role: "employee",
        designation: "Employee",
        employeeStatus: "Inactive",
        status: "INACTIVE",
      },
      role: "employee",
      userData: { role: "employee" },
    });

    expect(user.isActive).toBe(false);
  });

  it("does not reactivate an inactive user during employee-to-user sync", async () => {
    const user = {
      role: "employee",
      designation: "Employee",
      passwordHash: "existing-password-hash",
      isActive: false,
      isApproved: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const employee = {
      _id: "employee-id",
      userID: "user-id",
      firstName: "Test",
      lastName: "Employee",
      email: "employee@example.com",
      role: "employee",
      designation: "Employee",
      employeeStatus: "Active",
      status: "ACTIVE",
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(User, "findById").mockResolvedValue(user);
    jest.spyOn(User, "findByIdAndUpdate").mockResolvedValue(user);

    await syncEmployeeToUser({
      employee,
      role: "employee",
      userData: { role: "employee" },
    });

    expect(user.isActive).toBe(false);
    expect(employee.employeeStatus).toBe("Inactive");
    expect(employee.status).toBe("INACTIVE");
    expect(employee.save).toHaveBeenCalledTimes(1);
  });
});
