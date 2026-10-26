const mongoose = require("mongoose");
const Announcement = require("../models/announcement");
const Notification = require("../models/notification");
const User = require("../models/User");
jest.mock("../services/fcm.service", () => ({
  sendPushNotification: jest.fn().mockResolvedValue({ success: true }),
}));
const { createAnnouncement, getUserNotifications } = require("../controllers/notificarionController");

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe("Announcement notifications", () => {
  afterEach(() => jest.restoreAllMocks());

  test("creates one broadcast notification record regardless of target-role recipients", async () => {
    const employee = { _id: new mongoose.Types.ObjectId(), role: "employee" };
    const anotherEmployee = { _id: new mongoose.Types.ObjectId(), role: "employee" };
    const admin = { _id: new mongoose.Types.ObjectId(), role: "admin" };
    const announcement = {
      _id: new mongoose.Types.ObjectId(),
      title: "Policy",
      message: "Updated policy",
      targetRole: "EMPLOYEE",
      isActive: true,
    };
    jest.spyOn(Announcement, "create").mockResolvedValue(announcement);
    jest.spyOn(User, "find").mockReturnValue({
      select: jest.fn().mockResolvedValue([employee, anotherEmployee, admin]),
    });
    const createNotification = jest.spyOn(Notification, "create").mockResolvedValue({});
    const res = makeResponse();

    await createAnnouncement({ body: announcement }, res);

    expect(res.statusCode).toBe(201);
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: null,
      type: "ANNOUNCEMENT",
      channel: "IN_APP",
      meta: expect.objectContaining({
        announcementId: announcement._id.toString(),
        status: "published",
        targetRole: "EMPLOYEE",
      }),
    }));
  });

  test("returns a role-targeted broadcast only to users in its target role", async () => {
    const employee = { _id: new mongoose.Types.ObjectId(), role: "employee" };
    const announcements = [
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
    jest.spyOn(User, "findById").mockReturnValue({
      select: jest.fn().mockResolvedValue(employee),
    });
    jest.spyOn(Notification, "find").mockReturnValue({
      sort: jest.fn().mockResolvedValue(announcements),
    });
    const res = makeResponse();

    await getUserNotifications({ params: { userId: employee._id.toString() } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([announcements[0], announcements[2]]);
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

    await getUserNotifications({ params: { userId: user._id.toString() } }, res);

    expect(res.body.data).toEqual([legacyNotification]);
  });
});
