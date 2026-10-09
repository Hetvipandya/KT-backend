const express = require("express");
const router = express.Router();

const { 
  createPerformance,
  getAllPerformance, 
  getPerformanceById,
  getPerformanceByEmployeeId,
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

// Get performance by Employee ID / User ID / Self (Management can view any, Employees can view self)
router.get("/employee/:employeeId", getPerformanceByEmployeeId);
router.get("/user/:userId", getPerformanceByEmployeeId);
router.get("/employee", getPerformanceByEmployeeId);
router.get("/user", getPerformanceByEmployeeId);
router.get("/my-performance", getPerformanceByEmployeeId);
router.get("/get-by-employee", getPerformanceByEmployeeId);

router.get("/:id", authorizeRoles("admin", "hr"), getPerformanceById);
router.delete("/delete/:id", authorizeRoles("admin", "hr"), deletePerformance);

module.exports = router;