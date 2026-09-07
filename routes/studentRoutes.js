const express = require("express");
const router = express.Router();

const {
  registerStudent,
  getAllStudents,
  updateStudent,
  addEducation,
  addSkills,
  applyInternship,
  updateApplicationStatus,
} = require("../controllers/studentController");


// ================= STUDENT =================
router.post("/register", registerStudent);
router.get("/list", getAllStudents);
router.put("/update/:id", updateStudent);


// ================= EDUCATION =================
router.post("/education/add", addEducation);


// ================= SKILLS =================
router.post("/skills/add", addSkills);


// ================= APPLICATION =================
router.post("/apply", applyInternship);
router.put("/application/status/:id", updateApplicationStatus);


module.exports = router;