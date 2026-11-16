const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Team = require("../models/Team");
const attendanceController = require("../controllers/attendanceController");

const createFindQuery = (result) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("team lead pending attendance scope", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const arrangeTeamScope = (teamLeadId, leadEmployeeId, subordinateEmployeeId, subordinateUserId) => {
    jest.spyOn(Employee, "findOne").mockReturnValue(
      createFindQuery({ _id: leadEmployeeId, userID: teamLeadId })
    );
    jest.spyOn(Team, "find").mockReturnValue(
      createFindQuery([{
        employees: [subordinateEmployeeId],
        members: [],
      }])
    );

    let employeeFindCall = 0;
    jest.spyOn(Employee, "find").mockImplementation(() => {
      employeeFindCall += 1;
      return createFindQuery(employeeFindCall === 1
        ? []
        : [{ _id: subordinateEmployeeId, userID: subordinateUserId }]);
    });

    const attendanceQueries = [];
    jest.spyOn(Attendance, "countDocuments").mockImplementation(async (query) => {
      attendanceQueries.push(query);
      return 0;
    });
    const findQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([]),
    };
    jest.spyOn(Attendance, "find").mockImplementation((query) => {
      attendanceQueries.push(query);
      return findQuery;
    });

    return attendanceQueries;
  };

  test("excludes the team lead's own check-in from team requests", async () => {
    const teamLeadId = new mongoose.Types.ObjectId();
    const leadEmployeeId = new mongoose.Types.ObjectId();
    const subordinateEmployeeId = new mongoose.Types.ObjectId();
    const subordinateUserId = new mongoose.Types.ObjectId();
    const attendanceQueries = arrangeTeamScope(
      teamLeadId,
      leadEmployeeId,
      subordinateEmployeeId,
      subordinateUserId
    );

    const response = createResponse();
    await attendanceController.getPendingAttendance({
      user: { _id: teamLeadId, role: "team lead" },
      query: {},
    }, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(attendanceQueries).toHaveLength(4);
    attendanceQueries.forEach((query) => {
      expect(query.userId.$ne.toString()).toBe(teamLeadId.toString());
      expect(query.userId.$in.map(String)).toContain(subordinateUserId.toString());
      expect(query.userId.$in.map(String)).not.toContain(teamLeadId.toString());
    });
  });

  test("does not allow a team lead to query their own request explicitly", async () => {
    const teamLeadId = new mongoose.Types.ObjectId();
    const leadEmployeeId = new mongoose.Types.ObjectId();
    const subordinateEmployeeId = new mongoose.Types.ObjectId();
    const subordinateUserId = new mongoose.Types.ObjectId();
    const attendanceQueries = arrangeTeamScope(
      teamLeadId,
      leadEmployeeId,
      subordinateEmployeeId,
      subordinateUserId
    );

    const response = createResponse();
    await attendanceController.getPendingAttendance({
      user: { _id: teamLeadId, role: "team lead" },
      query: { userId: teamLeadId.toString(), status: "all" },
    }, response);

    expect(response.status).toHaveBeenCalledWith(200);
    attendanceQueries.forEach((query) => {
      expect(query.userId.$in).toEqual([]);
      expect(query.userId.$ne.toString()).toBe(teamLeadId.toString());
    });
  });
});
