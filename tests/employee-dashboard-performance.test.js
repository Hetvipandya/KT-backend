const User = require("../models/User");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Session = require("../models/Session");
const TaskManagement = require("../models/taskModel");
const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const Holiday = require("../models/Holiday");
const employeePanelController = require("../controllers/employeePanelController");

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
    jest.spyOn(User, "find").mockReturnValue(createQuery([]));
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
    expect(leaveCountQueries[0]).toEqual({
      employeeId: user._id,
      status: { $in: ["pending", "pending_hr", "pending_admin"] },
    });
  });
});
