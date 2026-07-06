const express =
  require("express");

const router =
  express.Router();

const {
  createDailyReport,
  getAllDailyReports,
  getSingleDailyReport,
  updateReportStatus,
  addComment,
  deleteDailyReport,
} = require(
  "../controllers/dailyReportController"
);

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

// Get all reports
router.get(
  "/list",
  getAllDailyReports
);

// Get single report
router.get(
  "/:id",
  getSingleDailyReport
);

// Update report status
router.put(
  "/status/:id",
  updateReportStatus
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

module.exports = router;