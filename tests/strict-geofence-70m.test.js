const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Session = require("../models/Session");
const attendanceController = require("../controllers/attendanceController");
const {
  OFFICE_LOCATION,
  calculateDistanceMeters,
  validateAttendanceGeofence,
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

// Generates GPS coordinates at an exact distance north of the office location
const getCoordsAtDistanceNorth = (meters) => {
  const metersPerDegreeLat = 111195;
  const latDelta = meters / metersPerDegreeLat;
  return {
    latitude: parseFloat((OFFICE_LOCATION.latitude + latDelta).toFixed(6)),
    longitude: OFFICE_LOCATION.longitude,
  };
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

describe("Strict 70-Meter Office Geofencing Attendance System - 10 Core Scenarios", () => {
  /**
   * Scenario 1: Check-in inside 70m
   * Distance = 50m -> Check-in ALLOWED
   */
  test("Test 1 — Check-in inside 70m: Distance = 50m -> Check-in ALLOWED", async () => {
    const user = await User.create({
      name: "Test User 1",
      email: "user1@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const coords50m = getCoordsAtDistanceNorth(50);
    const measuredDist = Math.round(
      calculateDistanceMeters(
        coords50m.latitude,
        coords50m.longitude,
        OFFICE_LOCATION.latitude,
        OFFICE_LOCATION.longitude
      )
    );
    expect(measuredDist).toBeLessThanOrEqual(70);

    const req = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...coords50m,
      },
    };
    const res = createMockRes();

    await attendanceController.checkIn(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);

    const att = await Attendance.findOne({ userId: user._id, date: getToday() });
    expect(att).not.toBeNull();
    expect(att.checkInTime).not.toBeNull();
    expect(att.checkOutTime).toBeFalsy();
    expect(att.checkInLocation.distanceFromOffice).toBeLessThanOrEqual(70);
  });

  /**
   * Scenario 2: Check-in outside 70m
   * Distance = 100m -> Check-in REJECTED
   */
  test("Test 2 — Check-in outside 70m: Distance = 100m -> Check-in REJECTED", async () => {
    const user = await User.create({
      name: "Test User 2",
      email: "user2@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const coords100m = getCoordsAtDistanceNorth(100);
    const measuredDist = Math.round(
      calculateDistanceMeters(
        coords100m.latitude,
        coords100m.longitude,
        OFFICE_LOCATION.latitude,
        OFFICE_LOCATION.longitude
      )
    );
    expect(measuredDist).toBeGreaterThan(70);

    const req = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...coords100m,
      },
    };
    const res = createMockRes();

    await attendanceController.checkIn(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("outside the office location");
    expect(res.body.distance).toBeGreaterThan(70);

    // Verify no check-in record was created in database
    const att = await Attendance.findOne({ userId: user._id, date: getToday() });
    expect(att?.checkInTime).toBeFalsy();
  });

  /**
   * Scenario 3: Working user leaves radius
   * Check-in -> Working -> Distance becomes 80m -> AUTOMATIC CHECKOUT -> User remains logged in
   */
  test("Test 3 — Working user leaves radius: Check-in -> Working -> Distance = 80m -> AUTOMATIC CHECKOUT -> User remains logged in", async () => {
    const user = await User.create({
      name: "Test User 3",
      email: "user3@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    // 1. Check in inside office
    const insideCoords = {
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
    };
    const checkInRes = createMockRes();
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      checkInRes
    );
    expect(checkInRes.statusCode).toBe(201);

    // Ensure approved for working
    await Attendance.updateOne({ userId: user._id, date: getToday() }, { approvalStatus: "approved" });

    // 2. User is working, then distance becomes 80m (> 70m)
    const coords80m = getCoordsAtDistanceNorth(80);
    const pingReq = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...coords80m,
        immediate: true,
      },
    };
    const pingRes = createMockRes();

    await attendanceController.checkLocationGeofence(pingReq, pingRes);

    expect(pingRes.statusCode).toBe(200);
    expect(pingRes.body.success).toBe(true);
    expect(pingRes.body.isInside).toBe(false);
    expect(pingRes.body.autoCheckedOut).toBe(true);
    expect(pingRes.body.isCheckedOut).toBe(true);

    // CRITICAL: DO NOT LOG OUT USER
    expect(pingRes.body.autoLogout).toBe(false);
    expect(pingRes.body.shouldLogout).toBe(false);

    // Verify DB
    const att = await Attendance.findOne({ userId: user._id, date: getToday() });
    expect(att.checkOutTime).not.toBeNull();
    expect(att.autoCheckedOut).toBe(true);
    expect(att.autoCheckedOutBy).toBe("AUTO_GEOFENCE_CHECKOUT");
  });

  /**
   * Scenario 4: Working user stays inside
   * Check-in -> Distance remains <= 70m -> Continue working
   */
  test("Test 4 — Working user stays inside: Check-in -> Distance <= 70m -> Continue working", async () => {
    const user = await User.create({
      name: "Test User 4",
      email: "user4@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    // Check-in inside office
    const insideCoords = {
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
    };
    const checkInRes = createMockRes();
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      checkInRes
    );
    expect(checkInRes.statusCode).toBe(201);

    await Attendance.updateOne({ userId: user._id, date: getToday() }, { approvalStatus: "approved" });

    // Location update at 50m (<= 70m)
    const coords50m = getCoordsAtDistanceNorth(50);
    const pingReq = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...coords50m,
      },
    };
    const pingRes = createMockRes();

    await attendanceController.checkLocationGeofence(pingReq, pingRes);

    expect(pingRes.statusCode).toBe(200);
    expect(pingRes.body.isInside).toBe(true);
    expect(pingRes.body.autoCheckedOut).toBe(false);
    expect(pingRes.body.isCheckedIn).toBe(true);
    expect(pingRes.body.isCheckedOut).toBe(false);
    expect(pingRes.body.isOnBreak).toBe(false);

    // Verify DB: Still working, NOT checked out
    const att = await Attendance.findOne({ userId: user._id, date: getToday() });
    expect(att.checkOutTime).toBeFalsy();
    expect(att.autoCheckedOut).toBe(false);
  });

  /**
   * Scenario 5: Break inside office
   * Check-in -> Break-in inside 70m -> Break ACTIVE
   */
  test("Test 5 — Break inside office: Check-in -> Break-in inside 70m -> Break ACTIVE", async () => {
    const user = await User.create({
      name: "Test User 5",
      email: "user5@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const insideCoords = {
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
    };

    // Check-in
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );
    await Attendance.updateOne({ userId: user._id, date: getToday() }, { approvalStatus: "approved" });

    // Break-in inside 70m (30m from office)
    const coords30m = getCoordsAtDistanceNorth(30);
    const breakInReq = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...coords30m,
      },
    };
    const breakInRes = createMockRes();

    await attendanceController.startBreak(breakInReq, breakInRes);

    expect(breakInRes.statusCode).toBe(200);
    expect(breakInRes.body.success).toBe(true);
    expect(breakInRes.body.isOnBreak).toBe(true);

    const att = await Attendance.findOne({ userId: user._id, date: getToday() });
    expect(att.breaks.length).toBe(1);
    expect(att.breaks[0].startTime).not.toBeNull();
    expect(att.breaks[0].endTime).toBeNull(); // Break ACTIVE
    expect(att.checkOutTime).toBeFalsy();
  });

  /**
   * Scenario 6: User leaves during break
   * Break ACTIVE -> Distance becomes 100m -> NO CHECKOUT -> NO LOGOUT -> Break remains ACTIVE
   */
  test("Test 6 — User leaves during break: Break ACTIVE -> Distance = 100m -> NO CHECKOUT, NO LOGOUT -> Break remains ACTIVE", async () => {
    const user = await User.create({
      name: "Test User 6",
      email: "user6@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const insideCoords = {
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
    };

    // Check-in & Break-in
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );
    await Attendance.updateOne({ userId: user._id, date: getToday() }, { approvalStatus: "approved" });
    await attendanceController.startBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );

    // User leaves office: distance = 100m (> 70m) while ON BREAK
    const coords100m = getCoordsAtDistanceNorth(100);
    const pingReq = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...coords100m,
        immediate: true,
      },
    };
    const pingRes = createMockRes();

    await attendanceController.checkLocationGeofence(pingReq, pingRes);

    expect(pingRes.statusCode).toBe(200);
    expect(pingRes.body.isInside).toBe(false);
    expect(pingRes.body.isOnBreak).toBe(true);
    expect(pingRes.body.autoCheckedOut).toBe(false);
    expect(pingRes.body.autoLogout).toBe(false);
    expect(pingRes.body.shouldLogout).toBe(false);
    expect(pingRes.body.isCheckedOut).toBe(false);

    // Verify DB: Still NOT checked out, break still active
    const att = await Attendance.findOne({ userId: user._id, date: getToday() });
    expect(att.checkOutTime).toBeFalsy();
    expect(att.autoCheckedOut).toBe(false);
    expect(att.breaks[0].endTime).toBeNull();
  });

  /**
   * Scenario 7: Break-out outside office
   * Break ACTIVE -> Distance = 100m -> Break-out REJECTED -> Break remains ACTIVE
   */
  test("Test 7 — Break-out outside office: Break ACTIVE -> Distance = 100m -> Break-out REJECTED -> Break remains ACTIVE", async () => {
    const user = await User.create({
      name: "Test User 7",
      email: "user7@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const insideCoords = {
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
    };

    // Check-in & Break-in
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );
    await Attendance.updateOne({ userId: user._id, date: getToday() }, { approvalStatus: "approved" });
    await attendanceController.startBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );

    // User attempts Break-out while outside 70m (distance = 100m)
    const coords100m = getCoordsAtDistanceNorth(100);
    const breakOutReq = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...coords100m,
      },
    };
    const breakOutRes = createMockRes();

    await attendanceController.endBreak(breakOutReq, breakOutRes);

    expect(breakOutRes.statusCode).toBe(200);
    expect(breakOutRes.body.success).toBe(true);
    expect(breakOutRes.body.autoCheckedOut).toBe(true);

    // Verify DB: Break is COMPLETED and user is AUTO CHECKED OUT
    const att = await Attendance.findOne({ userId: user._id, date: getToday() });
    expect(att.breaks[0].endTime).toBeTruthy();
    expect(att.checkOutTime).toBeTruthy();
  });

  /**
   * Scenario 8: Return to office
   * Break ACTIVE -> Distance becomes 50m -> Break-out ALLOWED -> Working
   */
  test("Test 8 — Return to office: Break ACTIVE -> Distance = 50m -> Break-out ALLOWED -> Working", async () => {
    const user = await User.create({
      name: "Test User 8",
      email: "user8@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const insideCoords = {
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
    };

    // Check-in & Break-in
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );
    await Attendance.updateOne({ userId: user._id, date: getToday() }, { approvalStatus: "approved" });
    await attendanceController.startBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );

    // User returns inside 70m (distance = 50m) and calls Break-out
    const coords50m = getCoordsAtDistanceNorth(50);
    const breakOutReq = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...coords50m,
      },
    };
    const breakOutRes = createMockRes();

    await attendanceController.endBreak(breakOutReq, breakOutRes);

    expect(breakOutRes.statusCode).toBe(200);
    expect(breakOutRes.body.success).toBe(true);

    // Verify DB: Break has ended, user is now working (checkOutTime is null)
    const att = await Attendance.findOne({ userId: user._id, date: getToday() });
    expect(att.breaks[0].endTime).not.toBeNull();
    expect(att.checkOutTime).toBeFalsy();
  });

  /**
   * Scenario 9: Leave after break
   * Break-out -> Working -> Distance becomes 80m -> AUTOMATIC CHECKOUT -> User remains logged in
   */
  test("Test 9 — Leave after break: Break-out -> Working -> Distance = 80m -> AUTOMATIC CHECKOUT -> User remains logged in", async () => {
    const user = await User.create({
      name: "Test User 9",
      email: "user9@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const insideCoords = {
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
    };

    // Check-in -> Break-in -> Break-out (inside)
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );
    await Attendance.updateOne({ userId: user._id, date: getToday() }, { approvalStatus: "approved" });
    await attendanceController.startBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );
    await attendanceController.endBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );

    // User is now working. Moves outside to 80m.
    const coords80m = getCoordsAtDistanceNorth(80);
    const pingReq = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...coords80m,
        immediate: true,
      },
    };
    const pingRes = createMockRes();

    await attendanceController.checkLocationGeofence(pingReq, pingRes);

    expect(pingRes.statusCode).toBe(200);
    expect(pingRes.body.isInside).toBe(false);
    expect(pingRes.body.autoCheckedOut).toBe(true);
    expect(pingRes.body.isCheckedOut).toBe(true);
    expect(pingRes.body.autoLogout).toBe(false);
    expect(pingRes.body.shouldLogout).toBe(false);

    // Verify DB: Auto checked-out
    const att = await Attendance.findOne({ userId: user._id, date: getToday() });
    expect(att.checkOutTime).not.toBeNull();
    expect(att.autoCheckedOut).toBe(true);
    expect(att.autoCheckedOutBy).toBe("AUTO_GEOFENCE_CHECKOUT");
  });

  /**
   * Scenario 10: Direct API manipulation from outside 70m
   * Check-in, Break-in, Break-out, Check-out called from outside 70m are all REJECTED
   */
  test("Test 10 — Direct API manipulation: Check-in, Break-in, Break-out, Check-out from outside 70m are all REJECTED", async () => {
    const user = await User.create({
      name: "Test User 10",
      email: "user10@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const outsideCoords = getCoordsAtDistanceNorth(120); // 120m away

    // 1. Direct Check-in outside 70m -> REJECTED
    const checkInRes = createMockRes();
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...outsideCoords } },
      checkInRes
    );
    expect(checkInRes.statusCode).toBe(400);
    expect(checkInRes.body.success).toBe(false);

    // Now legitimately check in inside 70m to test subsequent actions
    const insideCoords = {
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
    };
    await attendanceController.checkIn(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );
    await Attendance.updateOne({ userId: user._id, date: getToday() }, { approvalStatus: "approved" });

    // 2. Direct Break-in outside 70m -> REJECTED
    const breakInRes = createMockRes();
    await attendanceController.startBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...outsideCoords } },
      breakInRes
    );
    expect(breakInRes.statusCode).toBe(400);
    expect(breakInRes.body.success).toBe(false);

    // Legitimately break in inside 70m
    await attendanceController.startBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      createMockRes()
    );

    // 3. Direct Break-out outside 70m -> Auto-checkout triggered
    const breakOutRes = createMockRes();
    await attendanceController.endBreak(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...outsideCoords } },
      breakOutRes
    );
    expect(breakOutRes.statusCode).toBe(200);
    expect(breakOutRes.body.success).toBe(true);
    expect(breakOutRes.body.autoCheckedOut).toBe(true);

    // 4. Direct Manual Check-out after auto checkout -> REJECTED (Already checked out)
    const checkOutRes = createMockRes();
    await attendanceController.checkOut(
      { user: { _id: user._id }, body: { userId: user._id.toString(), ...insideCoords } },
      checkOutRes
    );
    expect(checkOutRes.statusCode).toBe(400);
    expect(checkOutRes.body.success).toBe(false);
  });

  /**
   * Additional check: Frontend spoofing attempts (e.g. passing isInsideOffice: true)
   */
  test("Frontend spoofing attempt (isInsideOffice: true with coordinates outside 70m) is rejected", async () => {
    const user = await User.create({
      name: "Spoofer",
      email: "spoofer@example.com",
      password: "Password123",
      role: "employee",
      isApproved: true,
    });

    const outsideCoords = getCoordsAtDistanceNorth(150);
    const req = {
      user: { _id: user._id },
      body: {
        userId: user._id.toString(),
        ...outsideCoords,
        isInsideOffice: true,
        isInsideRadius: true,
        isInside: true,
      },
    };
    const res = createMockRes();

    await attendanceController.checkIn(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  /**
   * Additional check: Exactly 70 meters is considered inside
   */
  test("Exactly 70 meters is considered inside", () => {
    const exact70 = validateAttendanceGeofence({ distance: 70 });
    expect(exact70.isInside).toBe(true);
    expect(exact70.distance).toBe(70);

    const outside71 = validateAttendanceGeofence({ distance: 71 });
    expect(outside71.isInside).toBe(false);
    expect(outside71.distance).toBe(71);
  });
});
