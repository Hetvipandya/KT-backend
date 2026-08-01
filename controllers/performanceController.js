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
        "_id name email department firstName lastName"
      );

    const interns = await User.find({
      role: "intern",
    }).select("_id name email");

    const teamLeadUsers = await User.find({
      role: { $in: ["teamlead", "team lead"] },
    }).select("_id name email role department");

    const teamLeadEmployees = await Employee.find({
      isTeamLead: true,
    }).select("_id firstName lastName email department");

    // Format combined list of team leads without duplicates or admin users
    const teamLeadMap = new Map();

    teamLeadUsers.forEach((user) => {
      if (user.role !== "admin") {
        teamLeadMap.set(String(user._id), {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: "teamlead",
        });
      }
    });

    teamLeadEmployees.forEach((emp) => {
      const empName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email;
      if (!teamLeadMap.has(String(emp._id))) {
        teamLeadMap.set(String(emp._id), {
          _id: emp._id,
          name: empName,
          email: emp.email,
          role: "teamlead",
        });
      }
    });

    const teamLeads = Array.from(teamLeadMap.values());

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