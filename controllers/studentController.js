const Student = require("../models/Student");
const Education = require("../models/StudentEducation");
const Skills = require("../models/StudentSkills");



// ================= STUDENT =================
 
// REGISTER STUDENT
exports.registerStudent = async (req, res) => {
  try {
    const student = await Student.create(req.body);

    res.status(201).json({
      success: true,
      message: "Student registered successfully",
      data: student,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET ALL STUDENTS
exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.find();

    res.status(200).json({
      success: true,
      data: students,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE STUDENT
exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: student,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ================= EDUCATION =================

// ADD EDUCATION
exports.addEducation = async (req, res) => {
  try {
    const education = await Education.create(req.body);

    res.status(201).json({
      success: true,
      message: "Education added successfully",
      data: education,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ================= SKILLS =================

// ADD SKILLS
exports.addSkills = async (req, res) => {
  try {
    const skills = await Skills.create(req.body);

    res.status(201).json({
      success: true,
      message: "Skills added successfully",
      data: skills,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ================= APPLICATION =================

// APPLY INTERNSHIP
exports.applyInternship = async (req, res) => {
  try {
    const application = await Application.create(req.body);

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: application,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE APPLICATION STATUS
exports.updateApplicationStatus = async (req, res) => {
  try {
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Application status updated",
      data: application,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};