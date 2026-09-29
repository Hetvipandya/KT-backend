const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Session = require("../models/Session");
const attendanceController = require("../controllers/attendanceController");
const employeePanelController = require("../controllers/employeePanelController");
const {
  OFFICE_LOCATION,
  validateAttendanceGeofence,
  isBreakStartActive,
} = require("../utils/geofence");

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
});

describe("Geofence 70m Auto Check-Out & Break-Start Skip", () => {
  test("1. Office location radius is set to 70 meters by default", () => {
    expect(OFFICE_LOCATION.radiusMeters).toBe(70);
  });

  test("2. validateAttendanceGeofence accurately validates within and outside 70m", () => {
    // Exact office location: 0 meters away
    const insideOffice = validateAttendanceGeofence({
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
    });
    expect(insideOffice.isInside).toBe(true);
    expect(insideOffice.distance).toBeLessThanOrEqual(70);

    // Far away point (> 70 meters away)
    const outsideOffice = validateAttendanceGeofence({
      latitude: 23.060000,
      longitude: 72.540000,
    });
    expect(outsideOffice.isInside).toBe(false);
    expect(outsideOffice.distance).toBeGreaterThan(70);

    // Direct distance support
    const directInside = validateAttendanceGeofence({ distance: 45 });
    expect(directInside.isInside).toBe(true);
    expect(directInside.distance).toBe(45);

    const directOutside = validateAttendanceGeofence({ distance: 85 });
    expect(directOutside.isInside).toBe(false);
    expect(directOutside.distance).toBe(85);
  });

  test("3. isBreakStartActive correctly identifies active breaks across formats", () => {
    // Not on break
    expect(isBreakStartActive({ breaks: [] }, null, {})).toBe(false);
    expect(
      isBreakStartActive(
        { breaks: [{ startTime: new Date(), endTime: new Date() }] },
        null,
        {}
      )
    ).toBe(false);

    // Active break in attendance (startTime set, endTime null)
    expect(
      isBreakStartActive(
        { breaks: [{ startTime: new Date(), endTime: null }] },
        null,
        {}
      )
    ).toBe(true);

    // Break indicated in payload status
    expect(isBreakStartActive(null, null, { status: "break-start" })).toBe(true);
    expect(isBreakStartActive(null, null, { status: "break_start" })).toBe(true);
    expect(isBreakStartActive(null, null, { status: "break" })).toBe(true);
    expect(isBreakStartActive(null, null, { status: "on_break" })).toBe(true);
    expect(isBreakStartActive(null, null, { onBreak: true })).toBe(true);

    // Break in session status
    expect(isBreakStartActive(null, { status: "break" }, {})).toBe(true);
    expect(isBreakStartActive(null, { status: "break-start" }, {})).toBe(true);
  });

  test("4. Inside 70m: no auto check-out when device is inside office radius", async () => {
    const user = await User.create({
      name: "Rohan Patel",
      email: "rohan@example.com",
      password: "Password123",
      role: "employee",
    });

    const today = getToday();
    const attendance = await Attendance.create({
      userId: user._id,
      userType: "employee",
      date: today,
      checkInTime: new Date(),
      status: "present",
      approvalStatus: "approved",
    });

    const res = createMockRes();
    const req = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        latitude: OFFICE_LOCATION.latitude,
        longitude: OFFICE_LOCATION.longitude,
      },
    };

    await attendanceController.checkLocationGeofence(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isInside).toBe(true);
    expect(res.body.autoCheckedOut).toBe(false);

    const updatedAtt = await Attendance.findById(attendance._id);
    expect(updatedAtt.checkOutTime).toBeFalsy();
  });

  test("5. Outside 70m: auto check-out TRIGGERS when user is checked in and NOT on break", async () => {
    const user = await User.create({
      name: "Pooja Shah",
      email: "pooja@example.com",
      password: "Password123",
      role: "employee",
    });

    const today = getToday();
    const attendance = await Attendance.create({
      userId: user._id,
      userType: "employee",
      date: today,
      checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: "present",
      approvalStatus: "approved",
    });

    const session = await Session.create({
      userId: user._id,
      status: "active",
      startTime: new Date(),
    });

    const res = createMockRes();
    const req = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        distance: 120, // 120 meters away (> 70m)
      },
    };

    await attendanceController.checkLocationGeofence(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isInside).toBe(false);
    expect(res.body.distance).toBe(120);
    expect(res.body.autoCheckedOut).toBe(true);
    expect(res.body.isOnBreak).toBe(false);

    // Verify database record
    const updatedAtt = await Attendance.findById(attendance._id);
    expect(updatedAtt.checkOutTime).not.toBeNull();
    expect(updatedAtt.checkOutLocation.distanceFromOffice).toBe(120);

    const updatedSession = await Session.findById(session._id);
    expect(updatedSession.status).toBe("auto_checkout");
  });

  test("6. Outside 70m: auto check-out is SKIPPED when user status is break-start", async () => {
    const user = await User.create({
      name: "Meet Joshi",
      email: "meet@example.com",
      password: "Password123",
      role: "employee",
    });

    const today = getToday();
    // User has an active break started (endTime is null)
    const attendance = await Attendance.create({
      userId: user._id,
      userType: "employee",
      date: today,
      checkInTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
      breaks: [
        {
          startTime: new Date(Date.now() - 10 * 60 * 1000),
          endTime: null, // Active break currently running!
        },
      ],
      status: "present",
      approvalStatus: "approved",
    });

    const session = await Session.create({
      userId: user._id,
      status: "break",
      startTime: new Date(),
    });

    const res = createMockRes();
    const req = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        distance: 95, // 95 meters away (> 70m)
      },
    };

    await attendanceController.checkLocationGeofence(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isInside).toBe(false);
    expect(res.body.distance).toBe(95);
    expect(res.body.isOnBreak).toBe(true);
    expect(res.body.status).toBe("break-start");
    expect(res.body.autoCheckedOut).toBe(false);
    expect(res.body.message).toContain("Auto-checkout skipped");

    // Verify database: NOT checked out
    const updatedAtt = await Attendance.findById(attendance._id);
    expect(updatedAtt.checkOutTime).toBeFalsy();

    const updatedSession = await Session.findById(session._id);
    expect(updatedSession.status).toBe("break");
  });

  test("7. Outside 70m: auto check-out is SKIPPED when body explicitly passes status: 'break-start'", async () => {
    const user = await User.create({
      name: "Kavya Dave",
      email: "kavya@example.com",
      password: "Password123",
      role: "employee",
    });

    const today = getToday();
    const attendance = await Attendance.create({
      userId: user._id,
      userType: "employee",
      date: today,
      checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: "present",
      approvalStatus: "approved",
    });

    const res = createMockRes();
    const req = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        distance: 150, // > 70m
        status: "break-start", // Explicit break-start status
      },
    };

    await attendanceController.checkLocationGeofence(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isInside).toBe(false);
    expect(res.body.isOnBreak).toBe(true);
    expect(res.body.autoCheckedOut).toBe(false);

    // Verify database: NOT checked out
    const updatedAtt = await Attendance.findById(attendance._id);
    expect(updatedAtt.checkOutTime).toBeFalsy();
  });

  test("8. Outside 70m: no auto check-out if user is NOT checked in", async () => {
    const user = await User.create({
      name: "Amit Desai",
      email: "amit@example.com",
      password: "Password123",
      role: "employee",
    });

    const res = createMockRes();
    const req = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        distance: 100, // > 70m
      },
    };

    await attendanceController.checkLocationGeofence(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isCheckedIn).toBe(false);
    expect(res.body.autoCheckedOut).toBe(false);
  });

  test("9. employeePanel sessionHeartbeat respects break-start status outside 70m", async () => {
    const user = await User.create({
      name: "Bhavik Vyas",
      email: "bhavik@example.com",
      password: "Password123",
      role: "employee",
    });

    const today = getToday();
    await Attendance.create({
      userId: user._id,
      userType: "employee",
      date: today,
      checkInTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
      breaks: [{ startTime: new Date(), endTime: null }], // On break
      status: "present",
      approvalStatus: "approved",
    });

    const session = await Session.create({
      userId: user._id,
      sessionId: "sess_12345",
      status: "break",
      startTime: new Date(),
    });

    const res = createMockRes();
    const req = {
      user: { _id: user._id },
      body: {
        sessionId: "sess_12345",
        distance: 110, // > 70m
      },
    };

    await employeePanelController.sessionHeartbeat(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isOnBreak).toBe(true);
    expect(res.body.autoCheckedOut).toBe(false);
    expect(res.body.message).toContain("Auto-checkout skipped");

    const unchangedSession = await Session.findById(session._id);
    expect(unchangedSession.status).toBe("break");
  });
});
