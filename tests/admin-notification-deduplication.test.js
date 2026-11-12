const Notification = require("../models/notification");
const Announcement = require("../models/announcement");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const AdjustmentRequest = require("../models/AdjustmentRequest");
const notificationController = require("../controllers/notificarionController");

const queryResult = (value) => ({
  populate() { return this; },
  sort() { return this; },
  limit() { return this; },
  lean: jest.fn().mockResolvedValue(value),
});

const makeResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

describe("admin notification feed announcement deduplication", () => {
  afterEach(() => jest.restoreAllMocks());

  test("admin feed includes only notification records addressed to the signed-in admin", async () => {
    const announcementId = "64f000000000000000000001";
    const adminId = "64f000000000000000000099";
    const notifications = [
      {
      _id: "admin-notification",
      userId: { _id: adminId, name: "Admin", email: "admin@example.com" },
      title: "Company update",
      message: "Please review the announcement",
      type: "ANNOUNCEMENT",
      isRead: false,
      read: false,
      meta: { announcementId },
      createdAt: new Date("2026-10-26T09:40:47.280Z"),
      },
      {
        _id: "employee-notification",
        userId: { _id: "64f000000000000000000010", name: "Employee", email: "employee@example.com" },
        title: "Private update",
        message: "For another user",
        type: "SYSTEM",
        isRead: false,
        read: false,
        createdAt: new Date("2026-10-26T09:39:47.280Z"),
      },
    ];

    const find = jest.spyOn(Notification, "find").mockReturnValue(queryResult(notifications));
    jest.spyOn(Leave, "find").mockReturnValue(queryResult([]));
    jest.spyOn(Attendance, "find").mockReturnValue(queryResult([]));
    jest.spyOn(AdjustmentRequest, "find").mockReturnValue(queryResult([]));
    jest.spyOn(Announcement, "find").mockReturnValue(queryResult([]));

    const res = makeResponse();
    await notificationController.getAdminNotifications({ user: { _id: adminId } }, res);

    expect(find).toHaveBeenCalledWith({ userId: adminId });
    const announcementItems = res.body.data.filter((item) => item.type === "ANNOUNCEMENT");
    expect(announcementItems).toHaveLength(1);
    expect(announcementItems[0].recipientCount).toBeUndefined();
    expect(res.body.data.some((item) => item.title === "Private update")).toBe(false);
    expect(announcementItems[0].isRead).toBe(false);
    expect(res.body.unreadCount).toBe(1);
  });

  test("marks every recipient copy of a broadcast announcement as read together", async () => {
    const announcementId = "64f000000000000000000002";
    jest.spyOn(Notification, "findOne").mockReturnValue({
      select: jest.fn().mockResolvedValue({
        type: "ANNOUNCEMENT",
        meta: { announcementId },
      }),
    });
    const updateMany = jest.spyOn(Notification, "updateMany").mockResolvedValue({ modifiedCount: 11 });

    const res = makeResponse();
    const userId = "64f000000000000000000003";
    await notificationController.markAsRead({ user: { _id: userId }, params: { id: "notification-0" } }, res);

    expect(updateMany).toHaveBeenCalledWith(
      {
        userId,
        type: "ANNOUNCEMENT",
        $or: [
          { "meta.announcementId": announcementId },
          { "metaData.announcementId": announcementId },
        ],
      },
      { $set: expect.objectContaining({ read: true, isRead: true, readAt: expect.any(Date) }) },
    );
    expect(res.statusCode).toBe(200);
  });
});
