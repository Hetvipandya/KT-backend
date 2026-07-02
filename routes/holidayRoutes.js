const express = require("express");
const router = express.Router();

const {
  addHoliday,
  getAllHolidays,
  updateHoliday,
  deleteHoliday,
} = require("../controllers/holidayController");

router.post("/create", addHoliday);
router.get("/all", getAllHolidays);
router.put("/update/:id", updateHoliday);
router.delete("/delete/:id", deleteHoliday);

module.exports = router;