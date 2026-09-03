const express =
  require("express");

const router =
  express.Router();

const {
  createFollowUp,
  getFollowUpList,
  getSingleFollowUp,
  updateFollowUp,
  deleteFollowUp,
} = require(
  "../controllers/projectFollowUpController"
);

// =====================
// CREATE FOLLOW-UP
// =====================
router.post(
  "/create",
  createFollowUp
);

// =====================
// GET ALL FOLLOW-UPS
// =====================
router.get(
  "/list",
  getFollowUpList
);

// =====================
// GET SINGLE FOLLOW-UP
// =====================
router.get(
  "/:id",
  getSingleFollowUp
);

// =====================
// UPDATE FOLLOW-UP
// =====================
router.put(
  "/update/:id",
  updateFollowUp
);

// =====================
// DELETE FOLLOW-UP
// =====================
router.delete(
  "/delete/:id",
  deleteFollowUp
);

module.exports =
  router;