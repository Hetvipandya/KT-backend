const mongoose = require("mongoose");
const express = require("express");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Session = require("../models/Session");
const AdjustmentRequest = require("../models/AdjustmentRequest");
const attendanceController = require("../controllers/attendanceController");
const attendanceRoutes = require("../routes/attendanceRoutes");
const adjustmentRequestController = require("../controllers/adjustmentRequestController");
const { OFFICE_LOCATION } = require("../utils/geofence");
const { generateAccessToken } = require("../utils/jwt");

let mongoServer;

const createMockRes = () => {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
};

const getToday = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 60 * 60000);
  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, "0");
  const day = String(ist.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Attendance.deleteMany({});
  await User.deleteMany({});
  await Session.deleteMany({});
  await AdjustmentRequest.deleteMany({});
});

describe("Attendance break-time adjustments", () => {
  test("stores the full adjusted break duration and subtracts it from work time", async () => {
    const user = await User.create({
      name: "Adjustment Test",
      email: "adjustment-test@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });
    const res = createMockRes();

    await adjustmentRequestController.putAttendanceAdjustment(
      {
        body: {
          employeeId: user._id.toString(),
          date: "2026-09-30",
          reason: "Corrected break duration",
          sessions: [
            {
              checkin: "09:00",
              breakStart: "12:00",
              breakEnd: "14:30",
              checkout: "19:00",
            },
          ],
        },
      },
      res
    );

    expect(res.statusCode).toBe(200);
    const attendance = await Attendance.findOne({ userId: user._id, date: "2026-09-30" });
    expect(attendance.totalBreakTime).toBe(150);
    expect(attendance.breaks[0].duration).toBe(150);
    expect(attendance.totalWorkTime).toBe(7.5);

    const history = await AdjustmentRequest.findOne({ userId: user._id });
    expect(history.totalBreakTime).toBe(150);
    expect(history.totalWorkTime).toBe(7.5);
  });

  test("rejects a break adjustment with only one endpoint", async () => {
    const user = await User.create({
      name: "Invalid Adjustment Test",
      email: "invalid-adjustment-test@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });
    const res = createMockRes();

    await adjustmentRequestController.putAttendanceAdjustment(
      {
        body: {
          employeeId: user._id.toString(),
          date: "2026-09-30",
          reason: "Invalid break",
          sessions: [
            {
              checkin: "09:00",
              breakStart: "12:00",
              breakEnd: "",
              checkout: "18:00",
            },
          ],
        },
      },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Both break start and break end are required.");
  });

  test("adjusts break-start and break-end using patchAttendanceAdjustment with flat fields", async () => {
    const user = await User.create({
      name: "Patch Adjustment Test",
      email: "patch-adjustment-test@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });
    const res = createMockRes();

    await adjustmentRequestController.patchAttendanceAdjustment(
      {
        body: {
          employeeId: user._id.toString(),
          date: "2026-09-30",
          checkInTime: "09:00",
          checkOutTime: "18:00",
          breakStart: "13:00",
          breakEnd: "14:00",
          reason: "Patch adjustment for break",
        },
      },
      res
    );

    expect(res.statusCode).toBe(200);
    const attendance = await Attendance.findOne({ userId: user._id, date: "2026-09-30" });
    expect(attendance.totalBreakTime).toBe(60);
    expect(attendance.breaks.length).toBe(1);
    expect(attendance.breaks[0].duration).toBe(60);
    expect(attendance.totalWorkTime).toBe(8);

    const history = await AdjustmentRequest.findOne({ userId: user._id });
    expect(history.breakStart).toBe("13:00");
    expect(history.breakEnd).toBe("14:00");
    expect(history.totalBreakTime).toBe(60);
    expect(history.totalWorkTime).toBe(8);

    // Verify getAdjustmentHistory returns breakStart and breakEnd
    const histRes = createMockRes();
    await adjustmentRequestController.getAdjustmentHistory(
      { query: { employeeId: user._id.toString() } },
      histRes
    );
    expect(histRes.statusCode).toBe(200);
    expect(histRes.body.data[0].breakStart).toBe("13:00");
    expect(histRes.body.data[0].breakEnd).toBe("14:00");
  });

  test("adjusts break timing with seconds format in time strings", async () => {
    const user = await User.create({
      name: "Seconds Format Test",
      email: "seconds-adjustment-test@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });
    const res = createMockRes();

    await adjustmentRequestController.putAttendanceAdjustment(
      {
        params: { employeeId: user._id.toString(), date: "2026-09-30" },
        body: {
          checkInTime: "09:00:00",
          checkOutTime: "18:00:00",
          breakStart: "13:00:00",
          breakEnd: "14:15:00",
          reason: "Seconds format test",
        },
      },
      res
    );

    expect(res.statusCode).toBe(200);
    const attendance = await Attendance.findOne({ userId: user._id, date: "2026-09-30" });
    expect(attendance.totalBreakTime).toBe(75);
    expect(attendance.breaks[0].duration).toBe(75);
    expect(attendance.totalWorkTime).toBe(7.75);
  });
});

describe("Attendance detail timeline", () => {
  test("returns adjustment events and a timeline when check-in is missing", async () => {
    const user = await User.create({
      name: "Timeline Test",
      email: "timeline-test@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });
    const attendance = await Attendance.create({
      userId: user._id,
      userType: "employee",
      date: "2026-10-16",
      status: "present",
      approvalStatus: "approved",
      checkOutTime: new Date("2026-10-16T12:30:00.000Z"),
      adjustmentReason: "Check-in was not recorded",
    });
    const res = createMockRes();

    await attendanceController.getAttendanceById(
      { params: { id: attendance._id.toString() } },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.data.timelineSegments).toEqual([
      {
        type: "grey",
        label: "No check-in recorded",
        fromMinutes: 600,
        toMinutes: 1140,
      },
    ]);
    expect(res.body.data.timelineEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "check-out" }),
        expect.objectContaining({
          type: "adjustment",
          description: "Check-in was not recorded",
        }),
      ]),
    );
  });
});

describe("Attendance approval authorization", () => {
  test("accepts login access tokens for admins and rejects body-supplied approver identities", async () => {
    const admin = await User.create({
      name: "Attendance Admin",
      email: "attendance-admin@example.com",
      phoneNumber: "9000000101",
      password: "Password123",
      role: "admin",
      isApproved: true,
      isActive: true,
    });
    const employee = await User.create({
      name: "Attendance Employee",
      email: "attendance-employee@example.com",
      phoneNumber: "9000000102",
      password: "Password123",
      role: "employee",
      isApproved: true,
      isActive: true,
    });
    const approvalRecord = await Attendance.create({
      userId: employee._id,
      userType: "employee",
      date: "2026-10-14",
      checkInTime: new Date("2026-10-14T04:30:00.000Z"),
    });
    const rejectionRecord = await Attendance.create({
      userId: employee._id,
      userType: "employee",
      date: "2026-10-13",
      checkInTime: new Date("2026-10-13T04:30:00.000Z"),
    });
    const app = express();
    app.use(express.json());
    app.use("/api/attendance", attendanceRoutes);

    const employeeToken = generateAccessToken({
      userId: employee._id.toString(),
      role: employee.role,
    });
    const adminToken = generateAccessToken({
      userId: admin._id.toString(),
      role: admin.role,
    });

    const unauthorizedApproval = await request(app)
      .post("/api/attendance/approve")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ attendanceId: approvalRecord._id, approvedBy: admin._id });
    expect(unauthorizedApproval.status).toBe(403);

    const approval = await request(app)
      .post("/api/attendance/approve")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ attendanceId: approvalRecord._id });
    expect(approval.status).toBe(200);
    expect(approval.body.success).toBe(true);
    const approvedAttendance = await Attendance.findById(approvalRecord._id);
    expect(approvedAttendance.approvedBy.toString()).toBe(admin._id.toString());

    const rejection = await request(app)
      .post("/api/attendance/reject")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        attendanceId: rejectionRecord._id,
        reason: "Incorrect check-in details",
      });
    expect(rejection.status).toBe(200);
    expect(rejection.body.data.approvalStatus).toBe("rejected");
  });
});

describe("Complete Attendance Flow (Check-In, Break-In, Break-Out, Check-Out, 1h Overdue)", () => {
  test("1. Complete attendance flow: Check-in -> Break-in -> Break-out (>1 hour overdue) -> Check-out", async () => {
    // 1. Create employee
    const user = await User.create({
      name: "Kuresh",
      email: "kuresh@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const officeCoords = {
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
    };

    // 2. Check-In
    const checkInReq = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...officeCoords,
      },
    };
    const checkInRes = createMockRes();
    await attendanceController.checkIn(checkInReq, checkInRes);

    expect(checkInRes.statusCode).toBe(201);
    expect(checkInRes.body.success).toBe(true);

    // Approve check-in so break can proceed
    const att = await Attendance.findOne({ userId: user._id, date: getToday() });
    att.approvalStatus = "approved";
    await att.save();

    // 3. Break-In (Start Break)
    const breakInReq = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...officeCoords,
      },
    };
    const breakInRes = createMockRes();
    await attendanceController.startBreak(breakInReq, breakInRes);

    expect(breakInRes.statusCode).toBe(200);
    expect(breakInRes.body.success).toBe(true);
    expect(breakInRes.body.isOnBreak).toBe(true);

    // 4. Simulate break lasting 75 minutes (> 1 hour / 60 minutes)
    const attOnBreak = await Attendance.findOne({ userId: user._id, date: getToday() });
    const seventyFiveMinAgo = new Date(Date.now() - 75 * 60 * 1000);
    attOnBreak.breaks[0].startTime = seventyFiveMinAgo;
    await attOnBreak.save();

    // 5. Break Status check while break is 75 mins
    const statusReq = {
      user: { _id: user._id },
      query: { userId: user._id.toString() },
    };
    const statusRes = createMockRes();
    await attendanceController.getBreakStatus(statusReq, statusRes);

    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.body.breakTimer.isOverdue).toBe(true);
    expect(statusRes.body.breakTimer.status).toBe("break_time_exceeded");
    expect(statusRes.body.breakTimer.overdueMinutes).toBeGreaterThanOrEqual(14);
    expect(statusRes.body.breakTimer.showPopup).toBe(true);
    expect(statusRes.body.breakTimer.popupType).toBe("overdue");

    // 6. Break-Out (End Break) after 1 hour+
    const breakOutReq = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...officeCoords,
      },
    };
    const breakOutRes = createMockRes();
    await attendanceController.endBreak(breakOutReq, breakOutRes);

    expect(breakOutRes.statusCode).toBe(200);
    expect(breakOutRes.body.success).toBe(true);
    expect(breakOutRes.body.isOverdue).toBe(true);
    expect(breakOutRes.body.overdueMinutes).toBeGreaterThanOrEqual(14);
    expect(breakOutRes.body.warning).toContain("1 hour");

    // 7. Check-Out
    const checkOutReq = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...officeCoords,
      },
    };
    const checkOutRes = createMockRes();
    await attendanceController.checkOut(checkOutReq, checkOutRes);

    expect(checkOutRes.statusCode).toBe(200);
    expect(checkOutRes.body.success).toBe(true);
    expect(checkOutRes.body.isBreakOverdue).toBe(true);
    expect(checkOutRes.body.overdueBreakMinutes).toBeGreaterThanOrEqual(14);

    const finalAtt = await Attendance.findOne({ userId: user._id, date: getToday() });
    expect(finalAtt.checkOutTime).not.toBeNull();
    expect(finalAtt.isBreakOverdue).toBe(true);
  });

  test("2. Flow validations: prevents double check-in, duplicate break-in, and break-out without break", async () => {
    const user = await User.create({
      name: "Hetvi",
      email: "hetvi@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const officeCoords = {
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
    };

    // Attempt break without check-in
    const breakWithoutCheckinRes = createMockRes();
    await attendanceController.startBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...officeCoords } },
      breakWithoutCheckinRes
    );
    expect(breakWithoutCheckinRes.statusCode).toBe(404);

    // Initial check-in
    const checkInRes = createMockRes();
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...officeCoords } },
      checkInRes
    );
    expect(checkInRes.statusCode).toBe(201);

    // Attempt duplicate check-in
    const dupCheckInRes = createMockRes();
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...officeCoords } },
      dupCheckInRes
    );
    expect(dupCheckInRes.statusCode).toBe(400);

    // Approve attendance
    await Attendance.updateOne({ userId: user._id, date: getToday() }, { approvalStatus: "approved" });

    // Start break
    const break1Res = createMockRes();
    await attendanceController.startBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...officeCoords } },
      break1Res
    );
    expect(break1Res.statusCode).toBe(200);

    // Attempt second break without ending first
    const break2Res = createMockRes();
    await attendanceController.startBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...officeCoords } },
      break2Res
    );
    expect(break2Res.statusCode).toBe(400);
    expect(break2Res.body.message).toContain("Break already started");

    // End break
    const endBreakRes = createMockRes();
    await attendanceController.endBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...officeCoords } },
      endBreakRes
    );
    expect(endBreakRes.statusCode).toBe(200);

    // Attempt second break-out without active break
    const endBreak2Res = createMockRes();
    await attendanceController.endBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...officeCoords } },
      endBreak2Res
    );
    expect(endBreak2Res.statusCode).toBe(400);
    expect(endBreak2Res.body.message).toContain("No active break found");

    // Check-out
    const checkOutRes = createMockRes();
    await attendanceController.checkOut(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...officeCoords } },
      checkOutRes
    );
    expect(checkOutRes.statusCode).toBe(200);

    // Attempt check-in after check-out
    const postCheckoutCheckinRes = createMockRes();
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...officeCoords } },
      postCheckoutCheckinRes
    );
    expect(postCheckoutCheckinRes.statusCode).toBe(400);
    expect(postCheckoutCheckinRes.body.message.toLowerCase()).toContain("already checked out");
  });
});
