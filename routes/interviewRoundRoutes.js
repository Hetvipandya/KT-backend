const router = require("express").Router();

const {
  addRound,
  createInterview,
  getAllInterviews,
  getInterviewById,
  getAllRounds,
  getRoundsByInterview,
  updateRound,
  deleteRound,
  approveInterview, 
  rejectInterview,
  approveCandidate,
  rejectCandidate,
} = require("../controllers/interviewRoundController");

// Create interview
router.post("/addInterview", createInterview);
router.get("/all", getAllInterviews);
router.get("/:id", getInterviewById);

// Add round
router.post("/add", addRound);

// Get all rounds
router.get("/", getAllRounds);

// Candidate approve / reject
router.put("/candidate/approve/:id", approveCandidate);
router.put("/candidate/reject/:id", rejectCandidate);

// Interview approve / reject
router.put("/approve/:id", approveInterview);
router.put("/reject/:id", rejectInterview);

// Get rounds by interview id
router.get("/:interviewId", getRoundsByInterview);

// Update round
router.put("/:id", updateRound);

// Delete round
router.delete("/:id", deleteRound);

module.exports = router;