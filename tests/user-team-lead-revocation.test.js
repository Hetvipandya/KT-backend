const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");
const TeamMember = require("../models/TeamMember");
const { rejectEmployee } = require("../controllers/userControllers");

describe("rejectEmployee team lead cleanup", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("removes the rejected team lead's teams and project memberships", async () => {
    const user = {
      _id: "user-id",
      uniqueID: "TL-001",
      save: jest.fn().mockResolvedValue(undefined),
    };
    const employee = {
      _id: "employee-id",
      userID: "user-id",
      userId: "user-id",
      employeeID: "EMP-001",
      employeeCode: "EMP-001",
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(User, "findById").mockResolvedValue(user);
    jest.spyOn(Employee, "findOne").mockResolvedValue(employee);
    const deleteTeams = jest
      .spyOn(Team, "deleteMany")
      .mockResolvedValue({ deletedCount: 1 });
    const deleteTeamMemberships = jest
      .spyOn(TeamMember, "deleteMany")
      .mockResolvedValue({ deletedCount: 1 });

    const res = {
      json: jest.fn().mockReturnValue(undefined),
    };

    await rejectEmployee({ body: { userId: "user-id" } }, res);

    expect(deleteTeams).toHaveBeenCalledWith({
      $or: [
        { teamLeadUser: "user-id" },
        { teamLeadEmployee: "employee-id" },
        { teamLeadId: { $in: ["TL-001", "EMP-001"] } },
      ],
    });
    expect(deleteTeamMemberships).toHaveBeenCalledWith({
      userId: { $in: ["user-id", "employee-id"] },
      role: "Team Lead",
    });
    expect(user.isApproved).toBe(false);
    expect(user.isActive).toBe(false);
    expect(user.status).toBe("rejected");
    expect(employee.status).toBe("INACTIVE");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-id",
          isApproved: false,
          isActive: false,
          status: "rejected",
          employeeStatus: "Inactive",
        }),
      }),
    );
  });
});
