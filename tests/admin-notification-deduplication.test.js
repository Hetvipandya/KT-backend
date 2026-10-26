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

  test("shows a broadcast announcement once when it has one record per recipient", async () => {
    const announcementId = "64f000000000000000000001";
    const notifications = Array.from({ length: 11 }, (_, index) => ({
      _id: `notification-${index}`,
      userId: { name: `Employee ${index}`, email: `employee${index}@example.com` },
      title: "Company update",
      message: "Please review the announcement",
      type: "ANNOUNCEMENT",
      isRead: index !== 10,
      read: index !== 10,
      meta: { announcementId },
      createdAt: new Date("2026-10-26T09:40:47.280Z"),
    }));

    jest.spyOn(Notification, "find").mockReturnValue(queryResult(notifications));
    jest.spyOn(Leave, "find").mockReturnValue(queryResult([]));
    jest.spyOn(Attendance, "find").mockReturnValue(queryResult([]));
    jest.spyOn(AdjustmentRequest, "find").mockReturnValue(queryResult([]));
    jest.spyOn(Announcement, "find").mockReturnValue(queryResult([]));

    const res = makeResponse();
    await notificationController.getAdminNotifications({}, res);

    const announcementItems = res.body.data.filter((item) => item.type === "ANNOUNCEMENT");
    expect(announcementItems).toHaveLength(1);
    expect(announcementItems[0].recipientCount).toBe(11);
    expect(announcementItems[0].notificationIds).toHaveLength(11);
    expect(announcementItems[0].isRead).toBe(false);
    expect(res.body.unreadCount).toBe(1);
  });

  test("marks every recipient copy of a broadcast announcement as read together", async () => {
    const announcementId = "64f000000000000000000002";
    jest.spyOn(Notification, "findById").mockReturnValue({
      select: jest.fn().mockResolvedValue({
        type: "ANNOUNCEMENT",
        meta: { announcementId },
      }),
    });
    const updateMany = jest.spyOn(Notification, "updateMany").mockResolvedValue({ modifiedCount: 11 });

    const res = makeResponse();
    await notificationController.markAsRead({ params: { id: "notification-0" } }, res);

    expect(updateMany).toHaveBeenCalledWith(
      {
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
