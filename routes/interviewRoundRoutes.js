const router = require("express").Router();

const {
  addRound,
  getAllRounds,
  getRoundsByInterview,
  updateRound,
  deleteRound,
} = require("../controllers/interviewRoundController");

router.post("/add", addRound);
router.get("/", getAllRounds);
router.get("/:interviewId", getRoundsByInterview);
router.put("/:id", updateRound);
router.delete("/:id", deleteRound);

module.exports = router;