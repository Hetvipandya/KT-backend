const express = require("express");

const router = express.Router();

const {
  checkIn,
  checkOut,
  startBreak,  
  endBreak, 
  getBreakStatus,
  getTodayAttendance,
  getAttendanceById,
  getPendingAttendance, 
  getAllAttendanceForAdmin, 
  approveAttendance, 
  rejectAttendance,
  getMyAttendanceHistory,
  getAttendanceByDate,
  getSingleAttendance, 
  getMonthlyAttendance,
  getAllAbsentAttendance,
  recalculateAllAttendance,
  checkLocationGeofence
} = require("../controllers/attendanceController");

const { protect } = require("../middleware/authMiddleware");

// ================= LOCATION GEOFENCE CHECK & AUTO CHECKOUT =================
router.post(
  "/check-location",
  protect,
  checkLocationGeofence
);

router.post(
  "/location-ping",
  protect,
  checkLocationGeofence
);

router.post(
  "/ping-location",
  protect,
  checkLocationGeofence
);

router.post(
  "/geofence-check",
  protect,
  checkLocationGeofence
);

router.get(
  "/check-location",
  protect,
  checkLocationGeofence
);

router.get(
  "/geofence-check",
  protect,
  checkLocationGeofence
);

// ================= RECALCULATE ALL ATTENDANCE =================
router.post(
  "/recalculate-all",
  protect,
  recalculateAllAttendance
);

// ================= CHECK IN =================
router.post(
  "/check-in",
  protect,
  checkIn 
);

// ================= CHECK OUT =================
router.post(
  "/check-out",
  protect,
  checkOut
);

// ================= BREAK START =================
router.post(
  "/break/start",
  protect,
  startBreak
);

// ================= BREAK END =================
router.post(
  "/break/end",
  protect,
  endBreak
);

// ================= BREAK STATUS & TIMER =================
router.get(
  "/break/status",
  protect,
  getBreakStatus
);

router.get(
  "/break/timer",
  protect,
  getBreakStatus
);

// ================= PENDING ATTENDANCE =================
router.get(
  "/pending",
  protect,
  getPendingAttendance
);

router.get(
  "/admin/all",
  protect,
  getAllAttendanceForAdmin
);
 
// ================= TODAY ATTENDANCE =================
router.get(
  "/today",
  protect,
  getTodayAttendance
);

// ================= ATTENDANCE REPORT =================
router.get(
  "/:id",
  protect,
  getAttendanceById
);



// ================= APPROVE ATTENDANCE =================
router.put(
  "/approve",
  protect,
  approveAttendance
);

// ================= REJECT ATTENDANCE =================
router.put(
  "/reject",
  protect,
  rejectAttendance
);

router.get(
  "/history/:userId",
  getMyAttendanceHistory
);

router.get(
  "/history/date/:date",
  getAttendanceByDate
);

router.get(
  "/history/details/:id",
  getSingleAttendance
);

router.get(
  "/history/month/:userId/:month",
  getMonthlyAttendance
);

router.get(
  "/absent/all",
  getAllAbsentAttendance
)

module.exports = router;