const EmployeePerformance = require("../models/EmployeePerformance");
const Employee = require("../models/Employee");
const User = require("../models/User");
const TeamLead = require("../models/Team");
const TeamLeadActivity = require("../models/TeamLeadActivity");

// =============================
// Create Performance / Team Lead Feedback
// =============================
exports.createPerformance = async (req, res) => {
  try {
    const {
      employeeID,
      performancePercentage,
      remarks,
      feedback,
      rating,
    } = req.body;

    // ============================================================
    // 1. Validate Employee ID
    // ============================================================
    if (!employeeID) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // ============================================================
    // 2. Validate Performance Percentage / Rating
    // ============================================================
    let percentage = 0;

    if (
      performancePercentage !== undefined &&
      performancePercentage !== null &&
      performancePercentage !== ""
    ) {
      percentage = Number(performancePercentage);

      if (
        Number.isNaN(percentage) ||
        percentage < 0 ||
        percentage > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Performance percentage must be between 0 and 100.",
        });
      }
    }

    let numericRating = 0;
    if (rating !== undefined && rating !== null && rating !== "") {
      numericRating = Number(rating);
      if (Number.isNaN(numericRating) || numericRating < 0 || numericRating > 10) {
        numericRating = 0;
      }
    }

    const feedbackText = feedback || remarks || "";

    // ============================================================
    // 3. Find Employee / Intern / Team Lead
    // ============================================================
    let employeeType = "";
    let employeeName = "";
    let employeeEmail = "";

    // 3.1 Check Employee Collection
    const empData = await Employee.findById(employeeID).select(
      "name email firstName lastName"
    );

    if (empData) {
      employeeType = "employee";
      employeeName =
        empData.name ||
        `${empData.firstName || ""} ${empData.lastName || ""}`.trim() ||
        empData.email ||
        "Unknown Employee";
      employeeEmail = empData.email || "";
    }

    // 3.2 Check Intern in User Collection
    if (!empData) {
      const userData = await User.findById(employeeID).select(
        "name email role firstName lastName"
      );

      if (userData && userData.role === "intern") {
        employeeType = "intern";
        employeeName =
          userData.name ||
          `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
          userData.email ||
          "Unknown Intern";
        employeeEmail = userData.email || "";
      }
    }

    // 3.3 Check Team Lead
    if (!empData && !employeeType) {
      const teamLeadData = await TeamLead.findOne({
        $or: [
          { teamLead: employeeID },
          { user: employeeID },
        ],
      }).populate(
        "teamLead user",
        "name email firstName lastName"
      );

      if (teamLeadData) {
        const leadData =
          teamLeadData.teamLead || teamLeadData.user;

        if (leadData) {
          employeeType = "teamlead";
          employeeName =
            leadData.name ||
            `${leadData.firstName || ""} ${leadData.lastName || ""}`.trim() ||
            leadData.email ||
            "Unknown Team Lead";
          employeeEmail = leadData.email || "";
        }
      }
    }

    if (!employeeType) {
      return res.status(404).json({
        success: false,
        message:
          "Employee not found in any category (employee, intern, or teamlead)",
      });
    }

    // ============================================================
    // 4. Evaluator / SubmittedBy Info
    // ============================================================
    const submittedBy = req.user?._id || null;
    const evaluatorName = req.user?.name || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || req.user?.email || "";
    const evaluatorRole = req.user?.role || "";

    // ============================================================
    // 5. Create or Update Performance Record
    // ============================================================
    let performance = await EmployeePerformance.findOne({
      employeeID,
    });
 
    if (performance) {
      if (percentage > 0) performance.performancePercentage = percentage;
      if (numericRating > 0) performance.rating = numericRating;
      if (feedbackText) {
        performance.feedback = feedbackText;
        performance.remarks = feedbackText;
      }
      performance.submittedBy = submittedBy || performance.submittedBy;
      performance.evaluatorName = evaluatorName || performance.evaluatorName;
      performance.evaluatorRole = evaluatorRole || performance.evaluatorRole;

      await performance.save();
    } else {
      performance = await EmployeePerformance.create({
        employeeID,
        employeeType,
        employeeName,
        employeeEmail,
        performancePercentage: percentage,
        rating: numericRating,
        remarks: feedbackText,
        feedback: feedbackText,
        submittedBy,
        evaluatorName,
        evaluatorRole,
      });
    }

    // Record Team Lead Activity if submitted by a Team Lead
    const normRole = (evaluatorRole || "").toLowerCase().replace(/[_\s]+/g, "");
    if (normRole === "teamlead" || normRole === "teamleader") {
      try {
        await TeamLeadActivity.create({
          teamLeadId: submittedBy,
          employeeId: employeeID,
          activityType: "performance_monitoring",
          referenceId: performance._id,
          status: "completed",
          remarks: feedbackText,
        });
      } catch (actErr) {
        console.error("TeamLeadActivity creation warning:", actErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Performance feedback saved successfully.",
      data: performance,
    });

  } catch (err) {
    console.error("Error creating performance feedback:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// =============================
// Get All Performance (ONLY HR & ADMIN)
// =============================
exports.getAllPerformance = async (req, res) => {
  try {
    // Restrict access: Only HR and Admin can view performance feedback
    const userRole = (req.user?.role || "").toLowerCase().replace(/[_\s]+/g, "");
    if (userRole !== "admin" && userRole !== "hr") {
      return res.status(403).json({
        success: false,
        message: "Access restricted. Only HR and Admin can view performance feedback.",
      });
    }

    const performances = await EmployeePerformance.find()
      .populate(
        "employeeID",
        "name email department firstName lastName"
      )
      .populate(
        "submittedBy",
        "name email role"
      )
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
// Get Single Performance (ONLY HR & ADMIN)
// =============================
exports.getPerformanceById = async (req, res) => {
  try {
    // Restrict access: Only HR and Admin can view performance feedback
    const userRole = (req.user?.role || "").toLowerCase().replace(/[_\s]+/g, "");
    if (userRole !== "admin" && userRole !== "hr") {
      return res.status(403).json({
        success: false,
        message: "Access restricted. Only HR and Admin can view performance feedback.",
      });
    }

    const performance = await EmployeePerformance.findById(
      req.params.id
    )
      .populate(
        "employeeID",
        "name email department firstName lastName"
      )
      .populate(
        "submittedBy",
        "name email role"
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
    const {
      performancePercentage,
      remarks,
    } = req.body;

    // ==========================================
    // Validate Performance Percentage
    // ==========================================
    let updateData = {};

    if (
      performancePercentage !== undefined &&
      performancePercentage !== null &&
      performancePercentage !== ""
    ) {
      const percentage = Number(performancePercentage);

      if (
        isNaN(percentage) ||
        percentage < 0 ||
        percentage > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Performance percentage must be between 0 and 100.",
        });
      }

      updateData.performancePercentage = percentage;
    }

    // ==========================================
    // Update Remarks
    // ==========================================
    if (remarks !== undefined) {
      updateData.remarks = remarks;
    }

    // ==========================================
    // Update Performance
    // ==========================================
    const performance =
      await EmployeePerformance.findByIdAndUpdate(
        req.params.id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
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
    const performance =
      await EmployeePerformance.findByIdAndDelete(
        req.params.id
      );

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
    // ==========================================
    // Get Employees
    // ==========================================
    const employees = await Employee.find()
      .select(
        "_id name email department firstName lastName"
      )
      .lean();

    // ==========================================
    // Get Interns from User collection
    // ==========================================
    const interns = await User.find({
      role: "intern",
    })
      .select("_id name email")
      .lean();

    // ==========================================
    // Get Team Leads from User collection
    // ==========================================
    const teamLeadUsers = await User.find({
      role: {
        $in: ["teamlead", "team lead"],
      },
    })
      .select("_id name email role department")
      .lean();

    // ==========================================
    // Get Team Leads from Employee collection
    // ==========================================
    const teamLeadEmployees = await Employee.find({
      isTeamLead: true,
    })
      .select(
        "_id firstName lastName email department"
      )
      .lean();

    // ==========================================
    // Remove Duplicate Team Leads
    // ==========================================
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
      const empName =
        `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
        emp.email;

      if (!teamLeadMap.has(String(emp._id))) {
        teamLeadMap.set(String(emp._id), {
          _id: emp._id,
          name: empName,
          email: emp.email,
          type: "teamlead",
        });
      }
    });

    const teamLeads = Array.from(
      teamLeadMap.values()
    );

    // ==========================================
    // Combine All Employees
    // ==========================================
    const allEmployees = [
      ...employees.map((emp) => ({
        _id: emp._id,
        name:
          emp.name ||
          `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
          emp.email,
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

    // ==========================================
    // Sort by Name
    // ==========================================
    allEmployees.sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    res.json({
      success: true,
      data: allEmployees,
    });
  } catch (err) {
    console.error(
      "Error fetching dropdown data:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};