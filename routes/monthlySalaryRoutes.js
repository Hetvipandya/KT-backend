const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const {
  generateMonthlySalary,
  getMonthlySalaries,
  getMonthlySalaryById,
  updateMonthlySalary,
  approveMonthlySalary,
  payMonthlySalary,
  cancelMonthlySalary,
} = require("../controllers/monthlySalaryController");

// Protect all monthly salary routes
router.use(protect);

// View Monthly Salaries (CA, Accountant, Admin, HR, Super Admin, Employee)
router.get("/", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getMonthlySalaries);
router.get("/all", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getMonthlySalaries);
router.get("/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getMonthlySalaryById);

router.get("/employee/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getMonthlySalaryById);
router.get("/user/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getMonthlySalaryById);

// Generate, Update, Approve, Pay, Cancel (CA, Accountant, Admin, HR, Super Admin)
router.post("/generate", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), generateMonthlySalary);
router.post("/process", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), generateMonthlySalary);
router.put("/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), updateMonthlySalary);
router.post("/:id/approve", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), approveMonthlySalary);
router.put("/:id/approve", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), approveMonthlySalary);
router.post("/employee/:id/approve", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), approveMonthlySalary);
router.put("/employee/:id/approve", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), approveMonthlySalary);
router.post("/approve", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), approveMonthlySalary);
router.put("/approve", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), approveMonthlySalary);
router.post("/:id/pay", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), payMonthlySalary);
router.put("/:id/pay", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), payMonthlySalary);
router.post("/employee/:id/pay", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), payMonthlySalary);
router.put("/employee/:id/pay", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), payMonthlySalary);
router.post("/user/:id/pay", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), payMonthlySalary);
router.put("/user/:id/pay", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), payMonthlySalary);
router.post("/pay", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), payMonthlySalary);
router.put("/pay", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), payMonthlySalary);
router.post("/:id/cancel", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), cancelMonthlySalary);

module.exports = router;
