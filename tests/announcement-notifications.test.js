const mongoose = require("mongoose");
const Announcement = require("../models/announcement");
const User = require("../models/User");
jest.mock("../utils/sendNotification", () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
const { notify } = require("../utils/sendNotification");
const { createAnnouncement } = require("../controllers/notificarionController");

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe("Announcement recipient notifications", () => {
  afterEach(() => jest.restoreAllMocks());

  test("notifies only users whose role matches targetRole", async () => {
    const employee = { _id: new mongoose.Types.ObjectId(), role: "employee" };
    const admin = { _id: new mongoose.Types.ObjectId(), role: "admin" };
    const announcement = {
      _id: new mongoose.Types.ObjectId(), title: "Policy", message: "Updated policy",
      targetRole: "EMPLOYEE", isActive: true,
    };
    jest.spyOn(Announcement, "create").mockResolvedValue(announcement);
    jest.spyOn(User, "find").mockResolvedValue([employee, admin]);
    notify.mockClear();
    const res = makeResponse();

    await createAnnouncement({ body: announcement }, res);

    expect(res.statusCode).toBe(201);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: employee._id, type: "ANNOUNCEMENT", channel: "IN_APP",
      meta: expect.objectContaining({ announcementId: announcement._id.toString(), status: "published" }),
    }));
  });

  test("notifies all users when no targetRole is provided", async () => {
    const users = [
      { _id: new mongoose.Types.ObjectId(), role: "employee" },
      { _id: new mongoose.Types.ObjectId(), role: "admin" },
    ];
    const announcement = { _id: new mongoose.Types.ObjectId(), title: "All", message: "For everyone" };
    jest.spyOn(Announcement, "create").mockResolvedValue(announcement);
    jest.spyOn(User, "find").mockResolvedValue(users);
    notify.mockClear();
    const res = makeResponse();

    await createAnnouncement({ body: announcement }, res);

    expect(notify.mock.calls.map(([arg]) => String(arg.userId)).sort())
      .toEqual(users.map((user) => String(user._id)).sort());
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
