const express =
  require("express");

const router =
  express.Router();

const {
  createMilestone,
  getMilestones,
  getMilestoneById, 
  getMilestonesByProjectId,
  assignDeadline, 
  trackProgress,
  reviewMilestone, 
  completeMilestone,
} = require(
  "../controllers/milestoneController"
);


// CREATE
router.post(
  "/create",
  createMilestone
);

// GET ALL
router.get(
  "/",
  getMilestones
);

router.get("/project/:projectId", getMilestonesByProjectId);

// GET ONE
router.get(
  "/:id",
  getMilestoneById
);

// ASSIGN DEADLINE
router.put(
  "/deadline/:id",
  assignDeadline
);

// TRACK PROGRESS
router.post(
  "/progress/:id",
  trackProgress
);

// REVIEW
router.put(
  "/review/:id",
  reviewMilestone
);

// COMPLETE
router.put(
  "/complete/:id",
  completeMilestone
);

module.exports =
  router;