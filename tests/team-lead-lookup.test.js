const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");
const { getTeamLeadForUser } = require("../utils/teamLeadLookup");

const queryResult = (result) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

describe("getTeamLeadForUser", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("finds the team lead using the logged-in user's linked employee id", async () => {
    const userId = "user-1";
    const employeeId = "employee-1";
    const leadUserId = "lead-user-1";
    const leadEmployeeId = "lead-employee-1";
    const leadUser = {
      _id: leadUserId,
      name: "Team Lead",
      email: "lead@example.com",
      role: "team lead",
      uniqueID: "TL0001",
    };
    const leadEmployee = {
      _id: leadEmployeeId,
      firstName: "Team",
      lastName: "Lead",
      employeeID: "TL0001",
      designation: "Lead",
      department: "Engineering",
    };

    jest
      .spyOn(Employee, "findOne")
      .mockReturnValueOnce(queryResult({ _id: employeeId }));
    const teamQuery = queryResult({
      teamLeadUser: leadUserId,
      teamLeadEmployee: leadEmployeeId,
      teamLeadId: "TL0001",
    });
    jest.spyOn(Team, "findOne").mockReturnValue(teamQuery);
    jest
      .spyOn(User, "findById")
      .mockReturnValue(queryResult(leadUser));
    jest
      .spyOn(Employee, "findById")
      .mockReturnValue(queryResult(leadEmployee));

    await expect(getTeamLeadForUser(userId)).resolves.toEqual({
      userId: leadUserId,
      employeeId: leadEmployeeId,
      name: "Team Lead",
      email: "lead@example.com",
      role: "team lead",
      uniqueID: "TL0001",
      employeeID: "TL0001",
      designation: "Lead",
      department: "Engineering",
    });

    const teamFilter = Team.findOne.mock.calls[0][0];
    expect(teamFilter.$or[0]).toEqual({
      employees: { $in: [userId, employeeId] },
    });
    expect(teamFilter.$or[1]).toEqual({
      interns: { $in: [userId, employeeId] },
    });
  });

  test("returns null when the user is not assigned to a team", async () => {
    jest.spyOn(Employee, "findOne").mockReturnValue(queryResult(null));
    jest.spyOn(Team, "findOne").mockReturnValue(queryResult(null));

    await expect(getTeamLeadForUser("user-without-team")).resolves.toBeNull();
  });
});
