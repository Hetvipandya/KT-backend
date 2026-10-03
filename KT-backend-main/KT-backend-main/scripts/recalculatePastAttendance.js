const mongoose = require("mongoose");
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();

const Attendance = require("../models/Attendance");

const DEFAULT_LATE_CUTOFF = "10:10";
const DEFAULT_HALF_DAY_CUTOFF = "10:30";
const DEFAULT_ABSENT_CUTOFF = "15:00";
const DEFAULT_PRESENT_HOURS = 8;

const getTimeForDate = (dateObj, timeStr) => {
  const [hours, minutes] = (timeStr || "10:00").split(":").map(Number);
  const d = new Date(dateObj);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

const determineAttendanceStatus = (checkInTime) => {
  if (!checkInTime) {
    return {
      isLate: false,
      isAbsentDueToLate: false,
      status: "absent",
    };
  }

  const checkIn = new Date(checkInTime);
  if (Number.isNaN(checkIn.getTime())) {
    return {
      isLate: false,
      isAbsentDueToLate: false,
      status: "absent",
    };
  }

  const lateCutoff = getTimeForDate(checkIn, DEFAULT_LATE_CUTOFF);
  const halfDayCutoff = getTimeForDate(checkIn, DEFAULT_HALF_DAY_CUTOFF);
  const absentCutoff = getTimeForDate(checkIn, DEFAULT_ABSENT_CUTOFF);

  const timestamp = checkIn.getTime();
  const lateTimestamp = lateCutoff.getTime();
  const halfDayTimestamp = halfDayCutoff.getTime();
  const absentTimestamp = absentCutoff.getTime();

  if (timestamp <= lateTimestamp) {
    return {
      isLate: false,
      isHalfDay: false,
      isAbsentDueToLate: false,
      status: "present",
    };
  }

  if (timestamp <= halfDayTimestamp) {
    return {
      isLate: true,
      isHalfDay: false,
      isAbsentDueToLate: false,
      status: "present",
    };
  }

  if (timestamp <= absentTimestamp) {
    return {
      isLate: true,
      isHalfDay: true,
      isAbsentDueToLate: false,
      status: "half-day",
    };
  }

  return {
    isLate: true,
    isHalfDay: false,
    isAbsentDueToLate: true,
    status: "absent",
  };
};

const recalculateAll = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI not found in .env");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri, { family: 4 });
    console.log("Connected to MongoDB.");

    const records = await Attendance.find({});
    console.log(`Found ${records.length} attendance records to evaluate...`);

    let updatedCount = 0;

    for (const record of records) {
      // Calculate work time if checkIn and checkOut exist
      if (record.checkInTime && record.checkOutTime) {
        const diffMs = new Date(record.checkOutTime).getTime() - new Date(record.checkInTime).getTime();
        const breakMs = (record.totalBreakTime || 0) * 60 * 1000;
        const netHours = Math.max(0, (diffMs - breakMs) / (1000 * 60 * 60));
        record.totalWorkTime = Number(netHours.toFixed(2));
      }

      let newStatus = record.status;
      let newIsLate = record.isLate;

      if (!record.checkInTime) {
        newStatus = "absent";
        newIsLate = false;
      } else {
        const attStatus = determineAttendanceStatus(record.checkInTime);
        newIsLate = attStatus.isLate;

        if (attStatus.isAbsentDueToLate) {
          newStatus = "absent";
        } else if (
          attStatus.status === "half-day" ||
          (record.checkOutTime && (record.totalWorkTime || 0) < DEFAULT_PRESENT_HOURS)
        ) {
          newStatus = "half-day";
        } else {
          newStatus = "present";
        }
      }

      if (record.status !== newStatus || record.isLate !== newIsLate) {
        record.status = newStatus;
        record.isLate = newIsLate;
        await record.save();
        updatedCount++;
      }
    }

    console.log(`Successfully updated ${updatedCount} out of ${records.length} attendance records!`);
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  } catch (error) {
    console.error("Error recalculating attendance:", error);
    process.exit(1);
  }
};

recalculateAll();
