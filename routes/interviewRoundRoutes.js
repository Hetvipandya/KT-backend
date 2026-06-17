const router = require("express").Router();

const {
  addRound,
  createInterview,
  getAllRounds,
  getRoundsByInterview,
  updateRound,
  deleteRound,
  approveInterview,
  rejectInterview
} = require("../controllers/interviewRoundController");

router.post("/add", addRound);
router.post("/addInterview", createInterview);
router.get("/", getAllRounds);
router.get("/:interviewId", getRoundsByInterview);
router.put("/:id", updateRound);
router.delete("/:id", deleteRound);
router.put(
  "/approve/:id",
  approveInterview
);

router.put(
  "/reject/:id",
  rejectInterview
);

module.exports = router;