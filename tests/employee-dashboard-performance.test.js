const User = require("../models/User");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Session = require("../models/Session");
const TaskManagement = require("../models/taskModel");
const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const Holiday = require("../models/Holiday");
const employeePanelController = require("../controllers/employeePanelController");
const leaveController = require("../controllers/leaveController");
const attendanceController = require("../controllers/attendanceController");
const EmployeeDeduction = require("../models/EmployeeDeduction");

const createQuery = (result) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

describe("employee dashboard data loading", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("aggregates task stats and counts leave summaries instead of loading full lists", async () => {
    const user = {
      _id: "employee-1",
      name: "Test Employee",
      role: "employee",
    };
    const leaveCountQueries = [];

    jest.spyOn(User, "findById").mockReturnValue(createQuery(user));
    jest.spyOn(User, "find").mockReturnValue(createQuery([user]));
    jest.spyOn(Employee, "findOne").mockReturnValue(createQuery(null));
    jest.spyOn(Employee, "find").mockReturnValue(createQuery([]));
    jest.spyOn(Attendance, "findOne")
      .mockReturnValueOnce(createQuery(null))
      .mockReturnValueOnce({
        ...createQuery(null),
        sort: jest.fn().mockReturnThis(),
      });
    jest.spyOn(Session, "findOne").mockReturnValue({
      ...createQuery(null),
      sort: jest.fn().mockReturnThis(),
    });
    jest.spyOn(TaskManagement, "aggregate").mockResolvedValue([
      { _id: "Pending", count: 2 },
      { _id: "pending", count: 1 },
      { _id: "In Progress", count: 1 },
      { _id: "in_progress", count: 1 },
      { _id: "Completed", count: 4 },
      { _id: "completed", count: 1 },
    ]);
    jest.spyOn(TaskManagement, "find");
    jest.spyOn(LeaveBalance, "findOne").mockReturnValue(createQuery(null));
    jest.spyOn(Holiday, "find").mockReturnValue(createQuery([]));
    jest.spyOn(Leave, "find").mockReturnValue(createQuery([]));
    jest.spyOn(Leave, "countDocuments").mockImplementation(async (query) => {
      leaveCountQueries.push(query);
      return leaveCountQueries.length === 1 ? 3 : 1;
    });

    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    await employeePanelController.getEmployeeDashboard(
      { user },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    const payload = response.json.mock.calls[0][0].data;
    expect(payload.statistics).toMatchObject({
      totalAssignedTasks: 10,
      tasksInProgress: 2,
      completedTasks: 5,
      pendingTasks: 3,
    });
    expect(payload.leaveSummary).toMatchObject({
      pendingRequests: 3,
      upcomingApprovedLeave: 1,
    });
    expect(TaskManagement.aggregate).toHaveBeenCalledTimes(1);
    expect(TaskManagement.find).not.toHaveBeenCalled();
    expect(Employee.find).toHaveBeenCalledWith({
      $or: [
        { userId: { $in: [user._id] } },
        { userID: { $in: [user._id] } },
      ],
    });
    expect(leaveCountQueries[0]).toEqual({
      employeeId: user._id,
      status: { $in: ["pending", "pending_hr", "pending_admin"] },
    });
  });

  test("returns only scoped sidebar request counts from projected summaries", async () => {
    jest.spyOn(Attendance, "countDocuments").mockResolvedValue(2);
    jest.spyOn(Leave, "find").mockReturnValue(createQuery([
      {
        applicantRole: "employee",
        teamLeadStatus: "approved",
        hrStatus: "pending",
        employeeId: {
          name: "Pending Employee",
          email: "pending@example.com",
          role: "employee",
        },
      },
      {
        applicantRole: "employee",
        hrStatus: "approved",
        employeeId: {
          name: "Approved Employee",
          email: "approved@example.com",
          role: "employee",
        },
      },
    ]));
    jest.spyOn(User, "countDocuments").mockResolvedValue(1);
    jest.spyOn(EmployeeDeduction, "countDocuments").mockResolvedValue(4);

    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    await leaveController.getSidebarRequestCounts(
      { user: { role: "admin" } },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: {
        checkIn: 2,
        leave: 1,
        employee: 1,
        deduction: 4,
      },
    });
    expect(Leave.find).toHaveBeenCalledWith({});
    expect(Leave.find.mock.results[0].value.select).toHaveBeenCalledWith(
      expect.stringContaining("employeeId status applicantRole"),
    );
    expect(User.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        isApproved: { $ne: true },
        approved: { $ne: true },
        status: { $ne: "approved" },
      }),
    );
    expect(EmployeeDeduction.countDocuments).toHaveBeenCalledWith({
      status: "Pending",
    });
  });

  test("counts attendance requests only for the authenticated employee", async () => {
    jest.spyOn(Attendance, "countDocuments").mockResolvedValue(1);

    await attendanceController.getPendingAttendanceCount({
      _id: "employee-1",
      role: "employee",
    });

    expect(Attendance.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "employee-1",
        checkInTime: { $ne: null },
      }),
    );
  });
});
