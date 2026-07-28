const EmployeePerformance = require("../models/EmployeePerformance");
const Employee = require("../models/Employee");
const User = require("../models/User");
const TeamLead = require("../models/Team");

// =============================
// Create Performance
// =============================
exports.createPerformance = async (req, res) => {
  try {
    const {
      employeeID,
      attendance,
      taskCompletion,
      projectContribution,
      lateComing,
      leave,
      managerRating,
      kpiScore,
      remarks,
    } = req.body;

    const exists = await EmployeePerformance.findOne({
      employeeID,
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Performance already exists for this employee.",
      });
    }

    const total =
      attendance +
      taskCompletion +
      projectContribution +
      managerRating +
      kpiScore -
      lateComing -
      leave;

    let overallGrade = "F";

    if (total >= 90) overallGrade = "A+";
    else if (total >= 80) overallGrade = "A";
    else if (total >= 70) overallGrade = "B";
    else if (total >= 60) overallGrade = "C";
    else if (total >= 50) overallGrade = "D";

    const performance = await EmployeePerformance.create({
      employeeID,
      attendance,
      taskCompletion,
      projectContribution,
      lateComing,
      leave,
      managerRating,
      kpiScore,
      overallGrade,
      remarks,
    });

    res.status(201).json({
      success: true,
      message: "Performance added successfully.",
      data: performance,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =============================
// Get All Performance
// =============================
exports.getAllPerformance = async (req, res) => {
  try {
    const performances =
      await EmployeePerformance.find()
        .populate(
          "employeeID",
          "name email department employeeId"
        )
        .sort({
          createdAt: -1,
        });

    res.json({
      success: true,
      count: performances.length,
      data: performances,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =============================
// Get Single Performance
// =============================
exports.getPerformanceById = async (req, res) => {
  try {
    const performance =
      await EmployeePerformance.findById(
        req.params.id
      ).populate(
        "employeeID",
        "name email department"
      );

    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance not found",
      });
    }

    res.json({
      success: true,
      data: performance,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =============================
// Update Performance
// =============================
exports.updatePerformance = async (req, res) => {
  try {
    const {
      attendance,
      taskCompletion,
      projectContribution,
      lateComing,
      leave,
      managerRating,
      kpiScore,
      remarks,
    } = req.body;

    const total =
      attendance +
      taskCompletion +
      projectContribution +
      managerRating +
      kpiScore -
      lateComing -
      leave;

    let overallGrade = "F";

    if (total >= 90) overallGrade = "A+";
    else if (total >= 80) overallGrade = "A";
    else if (total >= 70) overallGrade = "B";
    else if (total >= 60) overallGrade = "C";
    else if (total >= 50) overallGrade = "D";

    const performance =
      await EmployeePerformance.findByIdAndUpdate(
        req.params.id,
        {
          attendance,
          taskCompletion,
          projectContribution,
          lateComing,
          leave,
          managerRating,
          kpiScore,
          overallGrade,
          remarks,
        },
        {
          new: true,
        }
      );

    res.json({
      success: true,
      message: "Performance updated successfully.",
      data: performance,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =============================
// Delete Performance
// =============================
exports.deletePerformance = async (req, res) => {
  try {
    await EmployeePerformance.findByIdAndDelete(
      req.params.id
    );

    res.json({
      success: true,
      message: "Performance deleted successfully.",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =============================
// Dropdown Data
// Employee + Intern + TeamLead
// =============================
exports.getPerformanceDropdown = async (req, res) => {
  try {
    const employees =
      await Employee.find().select(
        "_id name email department"
      );

    const interns = await User.find({
      role: "intern",
    }).select("_id name email");

    const teamLeads =
      await TeamLead.find()
        .populate(
          "teamLeadUser",
          "name email"
        )
        .populate(
          "employees",
          "name email"
        )
        .populate(
          "interns",
          "name email"
        );

    res.json({
      success: true,
      employees,
      interns,
      teamLeads,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};