const express = require("express");
const router = express.Router();

// Cloudinary Upload Middleware
const upload = require("../middleware/uploadMiddleware");

const {
  assignTeamLead,
  removeTeamLead,
  addEmployee,
  getEmployeeList,
  getEmployeeProfile, 
  updateEmployee, 
  removeEmployee,
  getAllEmployeeHistory,
  getAllEmployeeDocuments,
  getEmployeeDocuments,
  getEmployeePerformance,
  createEmployeePerformance,
  upsertEmployeePerformance,
  deleteEmployeePerformance,
} = require("../controllers/employeeController");

// ================= FILE FIELDS =================
const employeeDocuments = upload.fields([
  {
    name: "aadharCard",
    maxCount: 1,
  },
  {
    name: "panCard",
    maxCount: 1,
  },
  {
    name: "resume",
    maxCount: 1,
  },
  {
    name: "offerLetter",
    maxCount: 1,
  },
  {
    name: "joiningLetter",
    maxCount: 1,
  },
  {
    name: "certificates",
    maxCount: 10,
  },
]);

// ================= TEAM LEAD =================
router.put("/assign-tl/:id", assignTeamLead);
router.put("/remove-tl/:id", removeTeamLead);

// ================= ADD EMPLOYEE =================
router.post(
  "/add",
  employeeDocuments,
  addEmployee
);

// ================= EMPLOYEE LIST =================
router.get(
  "/list",
  getEmployeeList
);

// ================= EMPLOYEE HISTORY =================
router.get(
  "/history",
  getAllEmployeeHistory
);

// ================= EMPLOYEE DOCUMENTS =================

// Get All Employee Documents
router.get(
  "/documents",
  getAllEmployeeDocuments
);

// Get Single Employee Documents
router.get(
  "/documents/:employeeId",
  getEmployeeDocuments
);

// ================= EMPLOYEE PERFORMANCE =================
router.post(
  "/performance/:employeeId",
  createEmployeePerformance
);

router.get(
  "/performance/:employeeId",
  getEmployeePerformance
);

router.put(
  "/performance/:employeeId",
  upsertEmployeePerformance
);

router.delete(
  "/performance/:employeeId",
  deleteEmployeePerformance
);

// ================= EMPLOYEE PROFILE =================
router.get(
  "/profile/:id",
  getEmployeeProfile
);

// ================= UPDATE EMPLOYEE =================
router.put(
  "/update/:id",
  employeeDocuments,
  updateEmployee
);

// ================= REMOVE EMPLOYEE =================
router.delete(
  "/remove/:id",
  removeEmployee
);

module.exports = router;