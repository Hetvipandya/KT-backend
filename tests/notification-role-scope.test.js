const mongoose = require("mongoose");
const User = require("../models/User");
const { createNotificationForRole } = require("../services/notification.service");

describe("role notification company scope", () => {
  afterEach(() => jest.restoreAllMocks());

  test("does not include same-role users from other companies", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const findUsers = jest.spyOn(User, "find").mockReturnValue({
      select: () => ({ lean: jest.fn().mockResolvedValue([]) }),
    });

    const result = await createNotificationForRole({
      companyId,
      role: "employee",
      type: "SYSTEM",
      title: "Company update",
      message: "For this company's employees",
    });

    expect(findUsers).toHaveBeenCalledWith({
      $or: [
        { companyId, role: /^employee$/i },
        {
          companyAccess: {
            $elemMatch: {
              companyId,
              role: /^employee$/i,
              isActive: true,
            },
          },
        },
      ],
    });
    expect(result).toEqual({ count: 0, notifications: [] });
  });
});
