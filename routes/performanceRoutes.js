const express = require("express");
const router = express.Router();

const {
  createPerformance,
  getAllPerformance,
  getPerformanceById,
  updatePerformance,
  deletePerformance,
  getPerformanceDropdown,
} = require("../controllers/performanceController");

router.post("/create", createPerformance);

router.get("/all", getAllPerformance);

router.get("/dropdown", getPerformanceDropdown);

router.get("/:id", getPerformanceById);

router.put("/update/:id", updatePerformance);

router.delete("/delete/:id", deletePerformance);

module.exports = router;