const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");
const Leave = require("../models/Leave");
const leaveController = require("../controllers/leaveController");

describe("Team Lead Leave Visibility and Employee Name Enrichment Tests", () => {
  const harshLeadUser = {
    _id: "64f000000000000000000101",
    name: "Harsh TeamLead",
    email: "harsh@kevalon.com",
    role: "team lead",
    uniqueID: "TL1001",
  };

  const hetviEmployeeUser = {
    _id: "64f000000000000000000201",
    name: "Hetvi Patel",
    email: "hetvi@kevalon.com",
    role: "employee",
    uniqueID: "EMP2001",
  };

  const hetviEmployeeDoc = {
    _id: "64f000000000000000000301",
    name: "Hetvi Patel",
    firstName: "Hetvi",
    lastName: "Patel",
    email: "hetvi@kevalon.com",
    userID: hetviEmployeeUser._id,
    userId: hetviEmployeeUser._id,
    employeeID: "EMP2001",
    role: "employee",
    designation: "Frontend Developer",
    department: "IT",
  };

  const otherLeadUser = {
    _id: "64f000000000000000000901",
    name: "Other Lead",
    email: "other@kevalon.com",
    role: "team lead",
    uniqueID: "TL9001",
  };

  const hetviLeave = {
    _id: "64f000000000000000000501",
    employeeId: hetviEmployeeUser._id,
    applicantRole: "employee",
    leaveType: "full_day",
    startDate: new Date("2026-11-20"),
    endDate: new Date("2026-11-20"),
    totalDays: 1,
    reason: "Family function",
    status: "pending",
    teamLeadStatus: "pending",
    hrStatus: "pending",
    toObject() {
      return { ...this };
    },
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Harsh (Team Lead) can view Hetvi's pending leave with populated employeeName", async () => {
    jest.spyOn(User, "findById").mockImplementation((id) => {
      const idStr = String(id);
      if (idStr === String(harshLeadUser._id)) return Promise.resolve(harshLeadUser);
      if (idStr === String(hetviEmployeeUser._id)) return Promise.resolve(hetviEmployeeUser);
      return Promise.resolve(null);
    });

    jest.spyOn(User, "findOne").mockResolvedValue(null);
    jest.spyOn(User, "find").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([hetviEmployeeUser]),
      }),
    });

    jest.spyOn(Employee, "findById").mockImplementation((id) => {
      if (String(id) === String(hetviEmployeeDoc._id)) return Promise.resolve(hetviEmployeeDoc);
      return Promise.resolve(null);
    });
    jest.spyOn(Employee, "findOne").mockResolvedValue(null);
    jest.spyOn(Employee, "find").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([hetviEmployeeDoc]),
      }),
    });

    jest.spyOn(Team, "find").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "64f000000000000000000401",
            name: "Harsh TeamLead Team",
            teamLeadUser: harshLeadUser._id,
            employees: [hetviEmployeeDoc._id],
            interns: [],
            developers: [],
            designers: [],
            testers: [],
          },
        ]),
      }),
    });

    jest.spyOn(Leave, "find").mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            ...hetviLeave,
            employeeId: {
              _id: hetviEmployeeUser._id,
              name: hetviEmployeeUser.name,
              email: hetviEmployeeUser.email,
              role: hetviEmployeeUser.role,
            },
          },
        ]),
      }),
    });

    const req = {
      user: harshLeadUser,
    };

    let resultStatus = null;
    let resultBody = null;
    const res = {
      status(code) {
        resultStatus = code;
        return this;
      },
      json(data) {
        resultBody = data;
        return this;
      },
    };

    await leaveController.getAllLeaves(req, res);

    expect(resultStatus).toBe(200);
    expect(resultBody.success).toBe(true);
    expect(resultBody.total).toBe(1);

    const leaveItem = resultBody.data[0];
    expect(leaveItem.employeeName).toBe("Hetvi Patel");
    expect(leaveItem.name).toBe("Hetvi Patel");
    expect(leaveItem.employeeId.name).toBe("Hetvi Patel");
    expect(leaveItem.employeeId.email).toBe("hetvi@kevalon.com");
  });

  test("Other Team Lead does not see Hetvi's leaves if Hetvi is not in their team", async () => {
    jest.spyOn(User, "findById").mockImplementation((id) => {
      const idStr = String(id);
      if (idStr === String(otherLeadUser._id)) return Promise.resolve(otherLeadUser);
      return Promise.resolve(null);
    });
    jest.spyOn(User, "findOne").mockResolvedValue(null);
    jest.spyOn(User, "find").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    jest.spyOn(Employee, "findById").mockResolvedValue(null);
    jest.spyOn(Employee, "findOne").mockResolvedValue(null);
    jest.spyOn(Employee, "find").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    jest.spyOn(Team, "find").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "64f000000000000000000402",
            name: "Other Lead Team",
            teamLeadUser: otherLeadUser._id,
            employees: [],
            interns: [],
          },
        ]),
      }),
    });

    let queriedFilter = null;
    jest.spyOn(Leave, "find").mockImplementation((filter) => {
      queriedFilter = filter;
      return {
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([]),
        }),
      };
    });

    const req = {
      user: otherLeadUser,
    };

    let resultStatus = null;
    let resultBody = null;
    const res = {
      status(code) {
        resultStatus = code;
        return this;
      },
      json(data) {
        resultBody = data;
        return this;
      },
    };

    await leaveController.getAllLeaves(req, res);

    expect(resultStatus).toBe(200);
    expect(resultBody.total).toBe(0);
    const assignedIds = (queriedFilter.employeeId?.$in || []).map(String);
    expect(assignedIds).not.toContain(String(hetviEmployeeUser._id));
    expect(assignedIds).not.toContain(String(hetviEmployeeDoc._id));
  });
});
