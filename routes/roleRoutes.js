const express = require("express");
const router = express.Router();

const {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
} = require("../controllers/roleController");

// ==========================
// CREATE ROLE
// ==========================
router.post("/create", createRole);

// ==========================
// GET ALL ROLES
// ==========================
router.get("/list", getRoles);

// ==========================
// GET SINGLE ROLE
// ==========================
router.get("/get/:id", getRoleById);

// ==========================
// UPDATE ROLE
// ==========================
router.put("/update/:id", updateRole);

// ==========================
// DELETE ROLE (SOFT DELETE)
// ==========================
router.delete("/delete/:id", deleteRole);

module.exports = router;