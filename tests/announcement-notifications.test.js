const mongoose = require("mongoose");
const Announcement = require("../models/announcement");
const Notification = require("../models/notification");
const User = require("../models/User");
const Department = require("../models/Department");
jest.mock("../services/fcm.service", () => ({
  sendPushNotification: jest.fn().mockResolvedValue({ success: true }),
}));
const {
  createAnnouncement,
  getUserNotifications,
  getAnnouncements,
  getAdminAnnouncements,
} = require("../controllers/notificarionController");

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe("Announcement notifications", () => {
  afterEach(() => jest.restoreAllMocks());

  test("creates a saved user notification for every broadcast recipient", async () => {
    const employee = { _id: new mongoose.Types.ObjectId(), role: "employee" };
    const anotherEmployee = { _id: new mongoose.Types.ObjectId(), role: "employee" };
    const admin = { _id: new mongoose.Types.ObjectId(), role: "admin" };
    const announcement = {
      _id: new mongoose.Types.ObjectId(),
      title: "Policy",
      message: "Updated policy",
      targetRole: "ALL",
      isActive: true,
    };
    jest.spyOn(Announcement, "create").mockResolvedValue(announcement);
    jest.spyOn(User, "find").mockReturnValue({
      select: () => ({ lean: jest.fn().mockResolvedValue([employee, anotherEmployee, admin]) }),
    });
    const createNotification = jest.spyOn(Notification, "create").mockImplementation(async (notification) => notification);
    const res = makeResponse();

    await createAnnouncement({ body: announcement, user: { _id: admin._id } }, res);

    expect(res.statusCode).toBe(201);
    expect(createNotification).toHaveBeenCalledTimes(3);
    expect(createNotification.mock.calls.map(([notification]) => String(notification.userId))).toEqual([
      String(employee._id),
      String(anotherEmployee._id),
      String(admin._id),
    ]);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "ANNOUNCEMENT",
      channel: "IN_APP",
      meta: expect.objectContaining({
        announcementId: announcement._id.toString(),
        status: "published",
        targetRole: "ALL",
        targetType: "ALL",
      }),
    }));
  });

  test("creates notifications only for the selected employee", async () => {
    const selectedUser = { _id: new mongoose.Types.ObjectId(), role: "employee", email: "selected@example.com" };
    const otherEmployee = { _id: new mongoose.Types.ObjectId(), role: "employee", email: "other@example.com" };
    const selectedEmployee = { userID: selectedUser._id, email: selectedUser.email };
    const findEmployees = jest.spyOn(require("../models/Employee"), "find").mockReturnValue({
      select: () => ({ lean: jest.fn().mockResolvedValue([selectedEmployee]) }),
    });
    const findUsers = jest.spyOn(User, "find").mockReturnValue({
      select: () => ({ lean: jest.fn().mockResolvedValue([selectedUser, otherEmployee]) }),
    });
    jest.spyOn(Announcement, "create").mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      title: "Only you",
      message: "Selected recipient",
      targetType: "PERSON",
      targetRole: "ALL",
    });
    const createNotification = jest.spyOn(Notification, "create").mockImplementation(async (notification) => notification);
    const res = makeResponse();

    await createAnnouncement({
      user: { _id: new mongoose.Types.ObjectId() },
      body: {
        title: "Only you",
        message: "Selected recipient",
        targetType: "PERSON",
        targetUserIds: [selectedUser._id.toString()],
      },
    }, res);

    expect(res.statusCode).toBe(201);
    expect(findEmployees).toHaveBeenCalledWith(expect.objectContaining({
      $or: [
        { userID: { $in: [selectedUser._id.toString()] } },
        { userId: { $in: [selectedUser._id.toString()] } },
      ],
    }));
    expect(findUsers).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(String(createNotification.mock.calls[0][0].userId)).toBe(String(selectedUser._id));
  });

  test("creates notifications for active employees in the selected department", async () => {
    const departmentId = new mongoose.Types.ObjectId();
    const employeeUser = {
      _id: new mongoose.Types.ObjectId(),
      role: "employee",
      email: "department@example.com",
    };
    const department = { _id: departmentId, departmentName: "Engineering", name: "Engineering" };
    jest.spyOn(Department, "find").mockReturnValue({
      select: () => ({ lean: jest.fn().mockResolvedValue([department]) }),
    });
    jest.spyOn(require("../models/Employee"), "find").mockReturnValue({
      select: () => ({
        lean: jest.fn().mockResolvedValue([{
          departmentId,
          userID: employeeUser._id,
          email: employeeUser.email,
        }]),
      }),
    });
    jest.spyOn(User, "find").mockReturnValue({
      select: () => ({ lean: jest.fn().mockResolvedValue([employeeUser]) }),
    });
    jest.spyOn(Announcement, "create").mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      title: "Department update",
      message: "Engineering only",
      targetType: "DEPARTMENT",
      targetRole: "ALL",
    });
    const createNotification = jest.spyOn(Notification, "create").mockImplementation(async (notification) => notification);
    const res = makeResponse();

    await createAnnouncement({
      user: { _id: new mongoose.Types.ObjectId() },
      body: {
        title: "Department update",
        message: "Engineering only",
        targetType: "DEPARTMENT",
        targetDepartmentIds: [departmentId.toString()],
      },
    }, res);

    expect(res.statusCode).toBe(201);
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(String(createNotification.mock.calls[0][0].userId)).toBe(String(employeeUser._id));
    expect(createNotification.mock.calls[0][0].meta.targetType).toBe("DEPARTMENT");
  });

  test("announcement list exposes only announcements addressed to the signed-in user", async () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      role: "employee",
      email: "worker@example.com",
    };
    const departmentId = new mongoose.Types.ObjectId();
    const announcements = [
      { _id: "all", title: "Everyone", message: "All", targetType: "ALL" },
      { _id: "person", title: "Other person", message: "Private", targetType: "PERSON", targetUserIds: [new mongoose.Types.ObjectId()] },
      { _id: "department", title: "Engineering", message: "Team only", targetType: "DEPARTMENT", targetDepartmentIds: [departmentId] },
      { _id: "role", title: "HR", message: "HR only", targetType: "ROLE", targetRole: "HR" },
    ];
    jest.spyOn(Announcement, "find").mockReturnValue({
      sort: () => ({ lean: jest.fn().mockResolvedValue(announcements) }),
    });
    jest.spyOn(require("../models/Employee"), "findOne").mockReturnValue({
      select: () => ({
        lean: jest.fn().mockResolvedValue({
          department: "Engineering",
          departmentId: null,
        }),
      }),
    });
    jest.spyOn(Department, "find").mockReturnValue({
      select: () => ({
        lean: jest.fn().mockResolvedValue([{
          _id: departmentId,
          departmentName: "Engineering",
        }]),
      }),
    });
    const res = makeResponse();

    await getAnnouncements({ user }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.map((announcement) => announcement._id)).toEqual(["all", "department"]);
  });

  test("admin announcement list includes announcements for every audience type", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const announcements = [
      { _id: "all", targetType: "ALL" },
      { _id: "person", targetType: "PERSON", targetUserIds: [new mongoose.Types.ObjectId()] },
      { _id: "department", targetType: "DEPARTMENT", targetDepartmentIds: [new mongoose.Types.ObjectId()] },
      { _id: "role", targetType: "ROLE", targetRole: "employee" },
    ];
    const find = jest.spyOn(Announcement, "find").mockReturnValue({
      sort: () => ({ lean: jest.fn().mockResolvedValue(announcements) }),
    });
    const res = makeResponse();

    await getAdminAnnouncements({ user: { companyId } }, res);

    expect(find).toHaveBeenCalledWith({
      $or: [
        { companyId: { $in: [companyId.toString()] } },
        { companyId: null },
      ],
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual(announcements);
  });

  test("admin without a company scope only receives global announcements", async () => {
    const announcements = [{ _id: "global", companyId: null, targetType: "ALL" }];
    const find = jest.spyOn(Announcement, "find").mockReturnValue({
      sort: () => ({ lean: jest.fn().mockResolvedValue(announcements) }),
    });
    const res = makeResponse();

    await getAdminAnnouncements({ user: {} }, res);

    expect(find).toHaveBeenCalledWith({ companyId: null });
    expect(res.body.data).toEqual(announcements);
  });

  test("does not include recipient-less legacy notifications in a user's feed", async () => {
    const employee = { _id: new mongoose.Types.ObjectId(), role: "employee" };
    const announcements = [
      {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        type: "ANNOUNCEMENT",
        meta: { announcementId: "another-users-announcement", targetRole: "EMPLOYEE" },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        userId: null,
        type: "ANNOUNCEMENT",
        meta: { announcementId: "announcement-1", targetRole: "EMPLOYEE" },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        userId: null,
        type: "ANNOUNCEMENT",
        meta: { announcementId: "announcement-2", targetRole: "ADMIN" },
      },
      {
        _id: new mongoose.Types.ObjectId(),
        userId: null,
        type: "SYSTEM",
      },
    ];
    const find = jest.spyOn(Notification, "find").mockReturnValue({
      sort: jest.fn().mockResolvedValue(announcements),
    });
    const res = makeResponse();

    await getUserNotifications({ user: employee, params: { userId: employee._id.toString() } }, res);

    expect(res.statusCode).toBe(200);
    expect(find).toHaveBeenCalledWith({ userId: employee._id });
    expect(res.body.data).toEqual([]);
  });

  test("includes legacy per-user announcement rows without creating additional records", async () => {
    const user = { _id: new mongoose.Types.ObjectId(), role: "employee" };
    const legacyNotification = {
      _id: new mongoose.Types.ObjectId(),
      userId: user._id,
      type: "ANNOUNCEMENT",
      meta: { announcementId: "legacy-announcement", targetRole: "EMPLOYEE" },
    };
    jest.spyOn(User, "findById").mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });
    jest.spyOn(Notification, "find").mockReturnValue({
      sort: jest.fn().mockResolvedValue([legacyNotification]),
    });
    const res = makeResponse();

    await getUserNotifications({ user, params: { userId: user._id.toString() } }, res);

    expect(res.body.data).toEqual([legacyNotification]);
  });
});
