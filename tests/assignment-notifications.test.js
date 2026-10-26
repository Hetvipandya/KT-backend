jest.mock("../utils/sendNotification", () => ({
  notify: jest.fn().mockResolvedValue(undefined),
}));

const Employee = require("../models/Employee");
const User = require("../models/User");
const { notify } = require("../utils/sendNotification");
const { notifyNewAssignments } = require("../utils/assignmentNotifications");

describe("assignment notification dispatch", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    notify.mockClear();
  });

  it("notifies only newly assigned recipients using linked User IDs and assignment metadata", async () => {
    const previousEmployeeId = "employee-existing";
    const addedEmployeeId = "employee-added";
    const linkedUserId = "user-assignee";
    const internUserId = "user-intern";
    const assigningUserId = "user-assigner";

    jest.spyOn(Employee, "findById").mockImplementation(async (id) => {
      if (String(id) === previousEmployeeId) return { userID: "user-existing" };
      if (String(id) === addedEmployeeId) return { userID: linkedUserId };
      return null;
    });
    jest.spyOn(User, "findById").mockImplementation(async (id) => {
      if (String(id) === internUserId) return { _id: internUserId };
      if (String(id) === "user-existing") return { _id: "user-existing" };
      return null;
    });

    await notifyNewAssignments({
      before: [{ id: previousEmployeeId, kind: "employee" }],
      after: [
        { id: previousEmployeeId, kind: "employee" },
        { id: addedEmployeeId, kind: "employee" },
        { id: internUserId, kind: "user" },
      ],
      action: "TASK_REASSIGNED",
      entityType: "Task",
      recordId: "task-record-id",
      recordName: "Review",
      assignedBy: assigningUserId,
    });

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenNthCalledWith(1, expect.objectContaining({
      userId: linkedUserId,
      type: "TASK_REASSIGNED",
      meta: expect.objectContaining({ action: "TASK_REASSIGNED", recordId: "task-record-id", taskId: "task-record-id" }),
    }));
    expect(notify).toHaveBeenNthCalledWith(2, expect.objectContaining({
      userId: internUserId,
      type: "TASK_REASSIGNED",
      meta: expect.objectContaining({ action: "TASK_REASSIGNED", recordId: "task-record-id", taskId: "task-record-id" }),
    }));
    expect(notify.mock.calls.flat().some((payload) => payload?.userId === assigningUserId)).toBe(false);
  });
});

