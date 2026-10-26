const express = require("express");
const request = require("supertest");
const User = require("../models/User");
const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const leaveController = require("../controllers/leaveController");
const employeePanelController = require("../controllers/employeePanelController");
const { getTeamLeadForUser } = require("../utils/teamLeadLookup");
const { notify } = require("../utils/sendNotification");

jest.mock("../utils/sendNotification", () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

jest.mock("../utils/teamLeadLookup", () => ({
  getTeamLeadForUser: jest.fn(),
}));

jest.mock("../utils/leaveUtils", () => ({
  toDateString: jest.requireActual("../utils/leaveUtils").toDateString,
  calculateWorkingLeaveDays: jest.fn().mockResolvedValue({
    workingDays: 1,
    totalCalendarDays: 1,
    excludedSundays: 0,
    excludedHolidays: 0,
  }),
}));

describe("leave routing when an employee has no assigned Team Lead", () => {
  const employee = {
    _id: "64f000000000000000000001",
    role: "employee",
  };
  const submittedLeave = {
    _id: "64f000000000000000000002",
    employeeId: employee._id,
    status: "pending_hr",
    teamLeadStatus: "skipped",
    hrStatus: "pending",
  };
  let app;

  beforeEach(() => {
    jest.restoreAllMocks();
    notify.mockClear();
    getTeamLeadForUser.mockResolvedValue(null);

    app = express();
    app.use(express.json());
    app.post("/leave/apply", (req, res, next) => {
      req.user = employee;
      next();
    }, leaveController.applyLeave);
    app.post("/employee-panel/leave", (req, res, next) => {
      req.user = employee;
      next();
    }, employeePanelController.applyEmployeeLeaveRequest);
    app.post("/leave/hr-approval", leaveController.hrApproval);

    jest.spyOn(User, "findById").mockResolvedValue(employee);
    jest.spyOn(Leave, "create").mockResolvedValue(submittedLeave);
    jest.spyOn(LeaveBalance, "findOne").mockResolvedValue(null);
    jest.spyOn(LeaveBalance, "create").mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each(["/leave/apply", "/employee-panel/leave"])(
    "%s routes the request directly to HR",
    async (path) => {
      const response = await request(app)
        .post(path)
        .send({
          startDate: "2099-01-05",
          endDate: "2099-01-05",
          leaveType: "paid",
          reason: "Personal",
        });

      expect(response.status).toBe(201);
      expect(Leave.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: employee._id,
          status: "pending_hr",
          teamLeadStatus: "skipped",
          hrStatus: "pending",
        }),
      );
    },
  );

  test("keeps employee leave pending for Team Lead review when a lead is assigned", async () => {
    getTeamLeadForUser.mockResolvedValue({ userId: "64f000000000000000000003" });

    const response = await request(app)
      .post("/leave/apply")
      .send({
        startDate: "2099-01-05",
        endDate: "2099-01-05",
        leaveType: "paid",
        reason: "Personal",
      });

    expect(response.status).toBe(201);
    expect(Leave.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        teamLeadStatus: "pending",
      }),
    );
  });

  test("allows HR to process a leave that skipped the unassigned Team Lead stage", async () => {
    const leave = {
      ...submittedLeave,
      applicantRole: "employee",
      employeeId: { ...employee },
      totalDays: 1,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const balance = {
      usedLeaves: 0,
      remainingLeaves: 20,
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Leave, "findById").mockReturnValue({
      populate: jest.fn().mockResolvedValue(leave),
    });
    LeaveBalance.findOne.mockResolvedValue(balance);

    const response = await request(app)
      .post("/leave/hr-approval")
      .send({
        leaveId: leave._id,
        status: "approved",
        remark: "Approved",
      });

    expect(response.status).toBe(200);
    expect(leave.status).toBe("approved");
    expect(leave.hrStatus).toBe("approved");
    expect(leave.teamLeadStatus).toBe("skipped");
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: employee._id,
      type: "LEAVE_HR_APPROVED",
      meta: expect.objectContaining({ leaveId: leave._id, status: "approved", stage: "hr", reason: "Approved" }),
    }));
  });

  test("notifies only the leave applicant for Team Lead and Admin rejection", async () => {
    const teamLeadLeave = {
      _id: "64f000000000000000000010",
      employeeId: { _id: employee._id },
      applicantRole: "employee",
      teamLeadStatus: "pending",
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Leave, "findById").mockReturnValue({
      populate: jest.fn().mockResolvedValue(teamLeadLeave),
    });

    await leaveController.teamLeadApproval({
      user: { _id: "64f000000000000000000003" },
      body: { leaveId: teamLeadLeave._id, status: "rejected", remark: "Insufficient details" },
    }, { status: () => ({ json: jest.fn() }), json: jest.fn() });

    expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({
      userId: employee._id,
      type: "LEAVE_TEAM_LEAD_REJECTED",
      meta: expect.objectContaining({ leaveId: teamLeadLeave._id, status: "rejected", reason: "Insufficient details" }),
    }));

    notify.mockClear();
    const adminLeave = {
      _id: "64f000000000000000000011",
      employeeId: { _id: employee._id },
      applicantRole: "employee",
      status: "pending",
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Leave, "findById").mockReturnValue({
      populate: jest.fn().mockResolvedValue(adminLeave),
    });
    await leaveController.adminApproval({
      user: { _id: "64f000000000000000000003" },
      body: { leaveId: adminLeave._id, status: "rejected", remark: "Dates conflict" },
    }, { status: () => ({ json: jest.fn() }), json: jest.fn() });

    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: employee._id,
      type: "LEAVE_ADMIN_REJECTED",
      meta: expect.objectContaining({ leaveId: adminLeave._id, status: "rejected", reason: "Dates conflict" }),
    }));
    expect(notify.mock.calls[0][0].userId).not.toBe("64f000000000000000000003");
  });
});
