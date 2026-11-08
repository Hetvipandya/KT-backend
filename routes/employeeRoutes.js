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
  updateEmployee,
  updateEmployeeLifecycle,
  deleteEmployee,
  removeEmployee,
  deactivateEmployee,
  reactivateEmployee,
  hardDeleteEmployee,

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
  {
    name: "profileImage",
    maxCount: 1,
  },
  {
    name: "profileImg",
    maxCount: 1,
  },
  {
    name: "profilePhoto",
    maxCount: 1,
  },
  {
    name: "photo",
    maxCount: 1,
  },
  {
    name: "avatar",
    maxCount: 1,
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
// EDIT / UPDATE / LIFECYCLE EMPLOYEE
// ============================================================

// Employee lifecycle transition (Joining -> Probation -> Confirmation -> Resignation -> Exit)
router.put(
  "/lifecycle/:id",
  updateEmployeeLifecycle
);

// Update employee with action / fields
router.put(
  "/update/:id",
  employeeDocuments,
  updateEmployee
);

// Edit employee details + documents
router.put(
  "/edit/:id",
  employeeDocuments,
  editEmployee
);

// General PUT by ID fallback
router.put(
  "/:id",
  employeeDocuments,
  updateEmployee
);

// ============================================================
// DELETE / REMOVE EMPLOYEE
// ============================================================

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const requireAdminOrHr = [
  protect,
  authorizeRoles("admin", "hr", "super admin")
];

// Deactivation routes
router.post("/:id/deactivate", requireAdminOrHr, deactivateEmployee);
router.put("/:id/deactivate", requireAdminOrHr, deactivateEmployee);
router.patch("/:id/deactivate", requireAdminOrHr, deactivateEmployee);
router.put("/deactivate/:id", requireAdminOrHr, deactivateEmployee);

// Reactivation routes
router.post("/:id/reactivate", requireAdminOrHr, reactivateEmployee);
router.put("/:id/reactivate", requireAdminOrHr, reactivateEmployee);
router.patch("/:id/reactivate", requireAdminOrHr, reactivateEmployee);
router.put("/reactivate/:id", requireAdminOrHr, reactivateEmployee);

// Soft-delete routes (backward compatible with legacy delete calls)
router.delete("/delete/:id", requireAdminOrHr, deleteEmployee);
router.delete("/remove/:id", requireAdminOrHr, removeEmployee);
router.delete("/hard-delete/:id", protect, authorizeRoles("super admin"), hardDeleteEmployee);
router.delete("/:id", requireAdminOrHr, deleteEmployee);

// Delete employee + documents + related user/team (legacy compatibility)
router.delete(
  "/delete/:id",
  deleteEmployee
);

// Remove employee
router.delete(
  "/remove/:id",
  removeEmployee
);

module.exports = router;