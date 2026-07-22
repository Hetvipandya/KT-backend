const express = require("express");
const router = express.Router();

const {
  addHoliday,
  getAllHolidays,
  getCurrentMonthFestivalHolidays,
  updateHoliday,
  deleteHoliday, 
} = require("../controllers/holidayController");

router.post("/create", addHoliday);
router.get("/all", getAllHolidays);
router.get(
  "/current-month",
  getCurrentMonthFestivalHolidays
);
router.put("/update/:id", updateHoliday);
router.delete("/delete/:id", deleteHoliday);

module.exports = router; 