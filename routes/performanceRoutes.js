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

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

// Team Leads, Admin, and HR can submit/give feedback for employees
router.post("/create", authorizeRoles("team lead", "admin", "hr"), createPerformance); 
router.post("/feedback", authorizeRoles("team lead", "admin", "hr"), createPerformance); 
router.put("/update/:id", authorizeRoles("team lead", "admin", "hr"), updatePerformance);

// ONLY HR and Admin can view performance records and feedback
router.get("/all", authorizeRoles("admin", "hr"), getAllPerformance);
router.get("/dropdown", authorizeRoles("admin", "hr", "team lead"), getPerformanceDropdown);
router.get("/:id", authorizeRoles("admin", "hr"), getPerformanceById);
router.delete("/delete/:id", authorizeRoles("admin", "hr"), deletePerformance);

module.exports = router;