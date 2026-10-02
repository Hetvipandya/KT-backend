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
  attendanceController.clearAllGeofenceTimers?.();
  await Attendance.deleteMany({});
  await User.deleteMany({});
  await Session.deleteMany({});
});

afterEach(async () => {
  attendanceController.clearAllGeofenceTimers?.();
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
    const directInside = validateAttendanceGeofence({ distance: 50 });
    expect(directInside.isInside).toBe(true);
    expect(directInside.distance).toBe(50);

    const directOutside = validateAttendanceGeofence({ distance: 95 });
    expect(directOutside.isInside).toBe(false);
    expect(directOutside.distance).toBe(95);
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

  test("5. Outside 70m: initiates 10-second auto-checkout countdown when user is checked in and NOT on break", async () => {
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
    expect(res.body.autoCheckoutPending).toBe(true);
    expect(res.body.autoCheckoutDelaySeconds).toBe(10);
    expect(res.body.remainingSeconds).toBe(10);
    expect(res.body.autoCheckedOut).toBe(false);
    expect(res.body.isOnBreak).toBe(false);

    // Verify not checked out yet at 0 seconds
    const unchangedAtt = await Attendance.findById(attendance._id);
    expect(unchangedAtt.checkOutTime).toBeFalsy();
    expect(unchangedAtt.outsideGeofenceAt).not.toBeNull();
  });

  test("5b. Outside 70m: auto check-out TRIGGERS after 10 seconds outside 70m radius", async () => {
    const user = await User.create({
      name: "Pooja Shah 2",
      email: "pooja2@example.com",
      password: "Password123",
      role: "employee",
    });

    const today = getToday();
    const attendance = await Attendance.create({
      userId: user._id,
      userType: "employee",
      date: today,
      checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      outsideGeofenceAt: new Date(Date.now() - 11 * 1000), // 11 seconds ago
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
        distance: 120,
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
    expect(updatedAtt.autoCheckedOut).toBe(true);

    const updatedSession = await Session.findById(session._id);
    expect(updatedSession.status).toBe("auto_checkout");
  });

  test("5c. Outside 70m: auto check-out CANCELS if user returns inside 70m within 10 seconds", async () => {
    const user = await User.create({
      name: "Pooja Return",
      email: "pooja.return@example.com",
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

    // 1. Goes outside 70m -> starts 10-second timer
    const res1 = createMockRes();
    const req1 = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        distance: 120, // > 70m
      },
    };
    await attendanceController.checkLocationGeofence(req1, res1);
    expect(res1.body.autoCheckoutPending).toBe(true);
    expect(res1.body.autoCheckedOut).toBe(false);

    // 2. Returns inside 70m within 10 seconds
    const res2 = createMockRes();
    const req2 = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        distance: 35, // <= 70m (inside)
      },
    };
    await attendanceController.checkLocationGeofence(req2, res2);
    expect(res2.body.isInside).toBe(true);
    expect(res2.body.timerCancelled).toBe(true);
    expect(res2.body.autoCheckedOut).toBe(false);

    // 3. Verify user remains checked-in in DB
    const updatedAtt = await Attendance.findById(attendance._id);
    expect(updatedAtt.checkOutTime).toBeFalsy();
    expect(updatedAtt.autoCheckedOut).toBe(false);
  });

  test("5d. Outside 70m: background timer automatically checks out user in database after 10 seconds", async () => {
    const user = await User.create({
      name: "Pooja Timer",
      email: "pooja.timer@example.com",
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
        distance: 120,
        delaySeconds: 0.15, // 150ms for test
      },
    };

    await attendanceController.checkLocationGeofence(req, res);
    expect(res.body.autoCheckoutPending).toBe(true);
    expect(res.body.autoCheckedOut).toBe(false);

    // Wait for the background timer (250ms)
    await new Promise((resolve) => setTimeout(resolve, 250));

    const updatedAtt = await Attendance.findById(attendance._id);
    expect(updatedAtt.checkOutTime).not.toBeNull();
    expect(updatedAtt.autoCheckedOut).toBe(true);
  });

  test("5e. Outside 70m: auto check-out triggers immediately when immediate: true is provided", async () => {
    const user = await User.create({
      name: "Pooja Immediate",
      email: "pooja.imm@example.com",
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
        distance: 120,
        immediate: true,
      },
    };

    await attendanceController.checkLocationGeofence(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.autoCheckedOut).toBe(true);
    expect(res.body.isInside).toBe(false);

    const updatedAtt = await Attendance.findById(attendance._id);
    expect(updatedAtt.checkOutTime).not.toBeNull();
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

  test("10. BREAK_IN -> BREAK_OUT: outside 70m triggers auto checkout (Test 7); inside 70m remains CHECKED_IN (Test 8)", async () => {
    const user1 = await User.create({
      name: "Trupti Outside",
      email: "trupti.outside@example.com",
      phoneNumber: "9876543210",
      password: "Password123",
      role: "employee",
    });

    const today = getToday();
    const attOutside = await Attendance.create({
      userId: user1._id,
      userType: "employee",
      date: today,
      checkInTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
      breaks: [{ startTime: new Date(Date.now() - 30 * 60 * 1000), endTime: null }],
      status: "present",
      approvalStatus: "approved",
    });

    // Test 7: BREAK_OUT while outside 70m (100m away) -> ends break, status becomes CHECKED_IN, triggers AUTO CHECKOUT
    const resOutside = createMockRes();
    const reqOutside = {
      user: { _id: user1._id },
      body: {
        userId: user1._id.toString(),
        distance: 100, // Outside 70m
      },
    };
    await attendanceController.endBreak(reqOutside, resOutside);

    expect(resOutside.statusCode).toBe(200);
    expect(resOutside.body.success).toBe(true);
    expect(resOutside.body.autoCheckedOut).toBe(true);

    const attOutsideUpdated = await Attendance.findById(attOutside._id);
    expect(attOutsideUpdated.breaks[0].endTime).not.toBeNull();
    expect(attOutsideUpdated.checkOutTime).not.toBeNull();
    expect(attOutsideUpdated.autoCheckedOut).toBe(true);

    // Test 8: BREAK_OUT while inside 70m (50m away) -> ends break, remains CHECKED_IN
    const user2 = await User.create({
      name: "Trupti Inside",
      email: "trupti.inside@example.com",
      phoneNumber: "9876543211",
      password: "Password123",
      role: "employee",
    });

    const attInside = await Attendance.create({
      userId: user2._id,
      userType: "employee",
      date: today,
      checkInTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
      breaks: [{ startTime: new Date(Date.now() - 30 * 60 * 1000), endTime: null }],
      status: "present",
      approvalStatus: "approved",
    });

    const resInside = createMockRes();
    const reqInside = {
      user: { _id: user2._id },
      body: {
        userId: user2._id.toString(),
        distance: 50, // Inside 70m
      },
    };
    await attendanceController.endBreak(reqInside, resInside);

    expect(resInside.statusCode).toBe(200);
    expect(resInside.body.success).toBe(true);

    const attInsideUpdated = await Attendance.findById(attInside._id);
    expect(attInsideUpdated.breaks[0].endTime).not.toBeNull();
    expect(attInsideUpdated.checkOutTime).toBeFalsy();
  });
});

