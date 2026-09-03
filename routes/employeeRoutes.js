const express = require("express");

const router = express.Router();

// ================= CLOUDINARY UPLOAD MIDDLEWARE =================
const upload = require("../middleware/uploadMiddleware");

// ================= CONTROLLER =================
const {
  assignTeamLead,
  removeTeamLead,

  addEmployee,
  editEmployee, 
  deleteEmployee,

  getEmployeeList,
  getEmployeeProfile,

  getAllEmployeeHistory,
  getAllEmployeeDocuments,
  getEmployeeDocuments,
} = require("../controllers/employeeController");

// ============================================================
// FILE FIELDS
// ============================================================
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

// ============================================================
// TEAM LEAD
// ============================================================

// Assign Employee as Team Lead
router.put(
  "/assign-tl/:id",
  assignTeamLead
);

// Remove Team Lead
router.put(
  "/remove-tl/:id",
  removeTeamLead
);

// ============================================================
// ADD EMPLOYEE
// ============================================================

router.post(
  "/add",
  employeeDocuments,
  addEmployee
);

// ============================================================
// EMPLOYEE LIST
// ============================================================

router.get(
  "/list",
  getEmployeeList
);

// ============================================================
// EMPLOYEE HISTORY
// ============================================================

// Get all employee history
router.get(
  "/history",
  getAllEmployeeHistory
);

// ============================================================
// EMPLOYEE DOCUMENTS
// ============================================================

// Get all employee documents
router.get(
  "/documents",
  getAllEmployeeDocuments
);

// Get single employee documents
router.get(
  "/documents/:employeeId",
  getEmployeeDocuments
);

// ============================================================
// EMPLOYEE PROFILE
// ============================================================

// Get single employee profile
router.get(
  "/profile/:id",
  getEmployeeProfile
);

// ============================================================
// EDIT / UPDATE EMPLOYEE
// ============================================================

// Edit employee details + documents
router.put(
  "/edit/:id",
  employeeDocuments,
  editEmployee
);

// ============================================================
// DELETE EMPLOYEE
// ============================================================

// Delete employee + documents + related user/team
router.delete(
  "/delete/:id",
  deleteEmployee
);

module.exports = router;