const EmployeePerformance = require("../models/EmployeePerformance");
const Employee = require("../models/Employee");
const User = require("../models/User");
const TeamLead = require("../models/Team");

// =============================
// Create Performance
// =============================
exports.createPerformance = async (req, res) => {
  try {
    const { employeeID, remarks } = req.body;

    if (!employeeID) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // Check if employee exists in any collection
    let employeeExists = false;

    // Check in Employee collection
    const empData = await Employee.findById(employeeID);
    if (empData) employeeExists = true;

    // Check in User collection (interns)
    if (!employeeExists) {
      const userData = await User.findById(employeeID);
      if (userData) employeeExists = true;
    }

    // Check in TeamLead
    if (!employeeExists) {
      const teamLeadData = await TeamLead.findOne({
        $or: [{ teamLead: employeeID }, { user: employeeID }],
      });
      if (teamLeadData) employeeExists = true;
    }

    if (!employeeExists) {
      return res.status(404).json({
        success: false,
        message: "Employee not found in any category",
      });
    }

    // Check if performance already exists
    const exists = await EmployeePerformance.findOne({ employeeID });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Performance already exists for this employee.",
      });
    }

    // Create performance record with just employeeID and remarks
    const performance = await EmployeePerformance.create({
      employeeID,
      remarks: remarks || "",
    });

    res.status(201).json({
      success: true,
      message: "Performance record created successfully.",
      data: performance,
    });
  } catch (err) {
    console.error("Error creating performance:", err);
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
    const performances = await EmployeePerformance.find()
      .populate("employeeID", "name email department firstName lastName")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: performances.length,
      data: performances,
    });
  } catch (err) {
    console.error("Error fetching performances:", err);
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
    const performance = await EmployeePerformance.findById(req.params.id)
      .populate("employeeID", "name email department firstNameLastName");

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
    console.error("Error fetching performance:", err);
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
    const { remarks } = req.body;

    const performance = await EmployeePerformance.findByIdAndUpdate(
      req.params.id,
      { remarks: remarks || "" },
      { new: true }
    );

    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance not found",
      });
    }

    res.json({
      success: true,
      message: "Performance updated successfully.",
      data: performance,
    });
  } catch (err) {
    console.error("Error updating performance:", err);
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
    const performance = await EmployeePerformance.findByIdAndDelete(req.params.id);

    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance not found",
      });
    }

    res.json({
      success: true,
      message: "Performance deleted successfully.",
    });
  } catch (err) {
    console.error("Error deleting performance:", err);
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
    // Get employees
    const employees = await Employee.find()
      .select("_id name email department firstName lastName")
      .lean();

    // Get interns from User collection
    const interns = await User.find({
      role: "intern",
    })
      .select("_id name email")
      .lean();

    // Get team leads
    const teamLeadUsers = await User.find({
      role: { $in: ["teamlead", "team lead"] },
    })
      .select("_id name email role department")
      .lean();

    const teamLeadEmployees = await Employee.find({
      isTeamLead: true,
    })
      .select("_id firstName lastName email department")
      .lean();

    // Format combined list of team leads without duplicates
    const teamLeadMap = new Map();

    teamLeadUsers.forEach((user) => {
      if (user.role !== "admin") {
        teamLeadMap.set(String(user._id), {
          _id: user._id,
          name: user.name || user.email,
          email: user.email,
          type: "teamlead",
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
          type: "teamlead",
        });
      }
    });

    const teamLeads = Array.from(teamLeadMap.values());

    // Combine all with type field
    const allEmployees = [
      ...employees.map((emp) => ({
        _id: emp._id,
        name: emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email,
        email: emp.email,
        type: "employee",
        department: emp.department,
      })),
      ...interns.map((intern) => ({
        _id: intern._id,
        name: intern.name || intern.email,
        email: intern.email,
        type: "intern",
      })),
      ...teamLeads.map((tl) => ({
        _id: tl._id,
        name: tl.name,
        email: tl.email,
        type: "teamlead",
      })),
    ];

    // Sort by name
    allEmployees.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: allEmployees,
    });
  } catch (err) {
    console.error("Error fetching dropdown data:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};