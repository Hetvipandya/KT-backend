const router = require("express").Router();

const {
  addRound,
  createInterview,
  getAllRounds,
  getRoundsByInterview,
  updateRound,
  deleteRound,
} = require("../controllers/interviewRoundController");

// Diagnostic: confirm this routes file is loaded on startup
console.log("[routes] interviewRoundRoutes loaded");

// Health endpoint for router
router.get("/ping", (req, res) => res.status(200).json({ success: true, message: "interviewRound router alive" }));

router.post("/add", addRound);
router.post("/add/interview", createInterview);
router.get("/", getAllRounds);
router.get("/:interviewId", getRoundsByInterview);
router.put("/:id", updateRound);
router.delete("/:id", deleteRound);

module.exports = router;