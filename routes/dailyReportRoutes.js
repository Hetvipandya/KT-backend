const express =
  require("express");

const router =
  express.Router();

const {
  createDailyReport,
  getAllDailyReports,  
  getTeamLeadDailyReports,
  getSingleDailyReport, 
  updateReportStatus,  
  updateDailyReport,
  addComment,
  deleteDailyReport,
} = require(
  "../controllers/dailyReportController"
);

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const jwt = require("jsonwebtoken");
const User = require("../models/User");

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && (decoded.id || decoded.userId)) {
        const userId = decoded.id || decoded.userId;
        const user = await User.findById(userId).select("-password").lean();
        if (user) {
          req.user = user;
        }
      }
    }
  } catch (e) {
    // Ignore token verification errors in optionalAuth
  }
  next();
};

router.use(optionalAuth);

// Approve Report
router.put(
  "/approve/:id",
  async (req, res) => {
    req.body.status =
      "Approved";

    return updateReportStatus(
      req,
      res
    );
  }
);

// Reject Report
router.put(
  "/reject/:id",
  async (req, res) => {
    req.body.status =
      "Rejected";

    return updateReportStatus( 
      req,
      res
    );
  }
);

// Under Review
router.put(
  "/review/:id",
  async (req, res) => {
    req.body.status =
      "Under Review";

    return updateReportStatus(
      req,
      res
    );
  }
);

// Create report
router.post(
  "/create",
  createDailyReport
);
router.post(
  "/",
  createDailyReport
);

// Get all reports
router.get(
  "/list",
  getAllDailyReports 
); 
router.get(
  "/",
  getAllDailyReports 
); 

router.get(
  "/team-lead/reports",
  protect,
  authorizeRoles("team lead"),
  getTeamLeadDailyReports
);

// Update report status
router.put(
  "/status/:id",
  updateReportStatus
);

// Update daily report details
router.put(
  "/update/:id",
  updateDailyReport
);

router.put(
  "/:id",
  updateDailyReport
);

// Get single report
router.get(
  "/:id",
  getSingleDailyReport
);

// Add comment
router.post(
  "/comment/:id",
  addComment
);

// Delete report
router.delete(
  "/delete/:id",
  deleteDailyReport
);

router.delete(
  "/:id",
  deleteDailyReport
);

module.exports = router;