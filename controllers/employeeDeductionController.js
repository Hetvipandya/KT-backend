const mongoose = require("mongoose");
const EmployeeDeduction = require("../models/EmployeeDeduction");
const DeductionMaster = require("../models/DeductionMaster");
const User = require("../models/User");
const Employee = require("../models/Employee");
const MonthlySalary = require("../models/MonthlySalary");
const SalaryStructure = require("../models/SalaryStructure");
const { getTeamLeadForUser } = require("../utils/teamLeadLookup");
const { generateDeductionRecordId } = require("../utils/deductionRecordId");
const {
  getApprovedLegallyPermissibleDeductions,
  logDeductionAudit,
} = require("../services/deduction.service");

// Helper to normalize user/employee IDs
const resolveEmployeeUser = async (identifier) => {
  if (!identifier) return null;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const user = await User.findById(identifier);
    if (user) return user;

    const employee = await Employee.findById(identifier);
    if (employee && (employee.userID || employee.userId)) {
      const linkedUser = await User.findById(employee.userID || employee.userId);
      if (linkedUser) return linkedUser;
    }
  }

  const user = await User.findOne({
    $or: [{ uniqueID: identifier }, { email: identifier }],
  });
  if (user) return user;

  const emp = await Employee.findOne({
    $or: [{ employeeID: identifier }, { employeeCode: identifier }],
  });
  if (emp && (emp.userID || emp.userId)) {
    return await User.findById(emp.userID || emp.userId);
  }

  return null;
};

// =====================================================
// CREATE EMPLOYEE DEDUCTION
// POST /api/employee-deductions
// =====================================================
const createEmployeeDeduction = async (req, res) => {
  try {
    const {
      employeeId,
      userId,
      teamLeadId: providedTeamLeadId,
      deductionMasterId,
      deductionRecordId: providedRecordId,
      month,
      year,
      amount,
      reason = "",
      remarks = "",
      companyId,
      branchId,
      isLegallyPermissible: explicitPermissible,
    } = req.body;

    const targetEmpId = employeeId || userId;
    if (!targetEmpId) {
      return res.status(400).json({
        success: false,
        message: "Mandatory field 'employeeId' is required",
      });
    }

    if (!deductionMasterId) {
      return res.status(400).json({
        success: false,
        message: "Mandatory field 'deductionMasterId' is required",
      });
    }

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: "month and year are required",
      });
    }

    const monthNum = Number(month);
    const yearNum = Number(year);
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: "Month must be between 1 and 12",
      });
    }

    if (amount === undefined || amount === null || Number(amount) < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid non-negative deduction amount is required",
      });
    }

    // 1. Resolve Employee User
    const employeeUser = await resolveEmployeeUser(targetEmpId);
    if (!employeeUser) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // 2. Resolve Deduction Master
    if (!mongoose.Types.ObjectId.isValid(deductionMasterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Deduction Master ID",
      });
    }

    const master = await DeductionMaster.findById(deductionMasterId);
    if (!master) {
      return res.status(404).json({
        success: false,
        message: "Deduction Master not found",
      });
    }

    if (!master.isActive) {
      return res.status(400).json({
        success: false,
        message: `Deduction Master "${master.name}" is currently inactive`,
      });
    }

    // 3. Resolve Mandatory Team Leader ID
    let finalTeamLeadId = providedTeamLeadId ? String(providedTeamLeadId).trim() : "";
    let teamLeadUserDoc = null;

    if (!finalTeamLeadId) {
      // Auto-lookup team lead for the employee
      try {
        const tlInfo = await getTeamLeadForUser(employeeUser._id);
        if (tlInfo) {
          finalTeamLeadId = tlInfo.uniqueID || tlInfo.employeeID || (tlInfo.userId ? tlInfo.userId.toString() : "");
          if (tlInfo.userId) {
            teamLeadUserDoc = await User.findById(tlInfo.userId);
          }
        }
      } catch (_) {}
    } else {
      // Validate provided team lead ID
      const tlUser = await resolveEmployeeUser(finalTeamLeadId);
      if (tlUser) {
        teamLeadUserDoc = tlUser;
      }
    }

    if (!finalTeamLeadId) {
      return res.status(400).json({
        success: false,
        message: "Mandatory field 'teamLeadId' is required and could not be automatically resolved for this employee",
      });
    }

    // 4. Resolve Mandatory Unique Deduction Record ID
    let finalRecordId = providedRecordId ? String(providedRecordId).trim().toUpperCase() : "";
    if (finalRecordId) {
      const duplicateRecord = await EmployeeDeduction.findOne({ deductionRecordId: finalRecordId });
      if (duplicateRecord) {
        return res.status(409).json({
          success: false,
          message: `Deduction Record ID "${finalRecordId}" already exists. Deduction Record ID must be strictly unique.`,
        });
      }
    } else {
      finalRecordId = await generateDeductionRecordId(monthNum, yearNum);
    }

    // 5. Duplicate Protection: Check if a non-rejected/non-cancelled record already exists
    // for this employee, master, month, and year
    const existingDeduction = await EmployeeDeduction.findOne({
      $or: [{ employeeId: employeeUser._id }, { userId: employeeUser._id }],
      deductionMasterId: master._id,
      month: monthNum,
      year: yearNum,
      status: { $in: ["Pending", "Approved"] },
    });

    if (existingDeduction) {
      return res.status(409).json({
        success: false,
        message: `A deduction of type "${master.name}" already exists for this employee for ${monthNum}/${yearNum} (Record ID: ${existingDeduction.deductionRecordId}, Status: ${existingDeduction.status})`,
        data: existingDeduction,
      });
    }

    // 6. Legal Permissibility Evaluation
    const isLegallyPermissible =
      explicitPermissible !== undefined
        ? Boolean(explicitPermissible) && master.isLegallyPermissible
        : master.isLegallyPermissible;

    // 7. Initialize Approval History
    const initialHistory = [
      {
        status: "Pending",
        actionBy: req.user ? req.user._id : null,
        actionByName: req.user ? req.user.name : "System",
        actionRole: req.user ? req.user.role : "HR",
        actionDate: new Date(),
        comments: reason || "Deduction request created and queued for approval",
        previousStatus: "",
      },
    ];

    const employeeDeduction = new EmployeeDeduction({
      deductionRecordId: finalRecordId,
      employeeId: employeeUser._id,
      userId: employeeUser._id,
      teamLeadId: finalTeamLeadId,
      teamLeadUser: teamLeadUserDoc ? teamLeadUserDoc._id : null,
      deductionMasterId: master._id,
      companyId: companyId || employeeUser.companyId || req.user?.companyId || null,
      branchId: branchId || employeeUser.branchId || req.user?.branchId || null,
      month: monthNum,
      year: yearNum,
      amount: Number(amount),
      reason: reason.trim(),
      remarks: remarks.trim(),
      isLegallyPermissible,
      legalReference: master.legalReference || "",
      status: "Pending",
      approvalHistory: initialHistory,
      isLocked: false,
      createdBy: req.user ? req.user._id : null,
      updatedBy: req.user ? req.user._id : null,
    });

    await employeeDeduction.save();

    const populatedDeduction = await EmployeeDeduction.findById(employeeDeduction._id)
      .populate("employeeId userId", "name email uniqueID role designation department")
      .populate("deductionMasterId", "name code category isLegallyPermissible legalReference calculationType")
      .populate("teamLeadUser", "name email uniqueID role");

    await logDeductionAudit(
      req,
      "CREATE_EMPLOYEE_DEDUCTION",
      employeeDeduction,
      `Created Employee Deduction record ${employeeDeduction.deductionRecordId} for employee ${employeeUser.name} amount Rs.${employeeDeduction.amount}`
    );

    return res.status(201).json({
      success: true,
      message: "Employee Deduction record created successfully",
      data: populatedDeduction || employeeDeduction,
    });
  } catch (error) {
    console.error("Create Employee Deduction Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create Employee Deduction",
      error: error.message,
    });
  }
};

// =====================================================
// GET ALL EMPLOYEE DEDUCTIONS
// GET /api/employee-deductions
// =====================================================
const getEmployeeDeductions = async (req, res) => {
  try {
    const {
      employeeId,
      userId,
      teamLeadId,
      deductionMasterId,
      deductionRecordId,
      month,
      year,
      status,
      isLocked,
      isLegallyPermissible,
      category,
      companyId,
      branchId,
    } = req.query;

    const query = {};

    const targetEmp = employeeId || userId;
    if (targetEmp) {
      if (mongoose.Types.ObjectId.isValid(targetEmp)) {
        query.$or = [{ employeeId: targetEmp }, { userId: targetEmp }];
      } else {
        const empUser = await resolveEmployeeUser(targetEmp);
        if (empUser) {
          query.$or = [{ employeeId: empUser._id }, { userId: empUser._id }];
        }
      }
    }

    if (teamLeadId) query.teamLeadId = teamLeadId;
    if (deductionMasterId) query.deductionMasterId = deductionMasterId;
    if (deductionRecordId) query.deductionRecordId = new RegExp(deductionRecordId.trim(), "i");
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    if (status) query.status = status;
    if (isLocked !== undefined) query.isLocked = isLocked === "true" || isLocked === true;
    if (isLegallyPermissible !== undefined) {
      query.isLegallyPermissible = isLegallyPermissible === "true" || isLegallyPermissible === true;
    }
    if (companyId) query.companyId = companyId;
    if (branchId) query.branchId = branchId;

    const deductions = await EmployeeDeduction.find(query)
      .populate("employeeId userId", "name email uniqueID role designation department employeeID employeeCode")
      .populate("deductionMasterId", "name code category isLegallyPermissible legalReference calculationType defaultAmount")
      .populate("teamLeadUser", "name email uniqueID role")
      .populate("approvedBy", "name email")
      .populate("lockedBy", "name email")
      .sort({ year: -1, month: -1, createdAt: -1 });

    // Filter by master category if requested
    let result = deductions;
    if (category) {
      result = deductions.filter(
        (d) => d.deductionMasterId && d.deductionMasterId.category === category
      );
    }

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Get Employee Deductions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Employee Deductions",
      error: error.message,
    });
  }
};

// =====================================================
// GET CURRENT USER'S DEDUCTIONS (FOR MOBILE & WEB EMPLOYEE)
// GET /api/employee-deductions/my-deductions
// =====================================================
const getMyDeductions = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { month, year, status } = req.query;
    const query = {
      $or: [{ employeeId: req.user._id }, { userId: req.user._id }],
    };

    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    if (status) query.status = status;

    const deductions = await EmployeeDeduction.find(query)
      .populate("deductionMasterId", "name code category isLegallyPermissible legalReference")
      .populate("approvedBy", "name email")
      .sort({ year: -1, month: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: deductions.length,
      data: deductions,
    });
  } catch (error) {
    console.error("Get My Deductions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your deductions",
      error: error.message,
    });
  }
};

// =====================================================
// GET EMPLOYEE DEDUCTION BY ID
// GET /api/employee-deductions/:id
// =====================================================
const getEmployeeDeductionById = async (req, res) => {
  try {
    const { id } = req.params;

    let deduction = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deduction = await EmployeeDeduction.findById(id)
        .populate("employeeId userId", "name email uniqueID role designation department")
        .populate("deductionMasterId")
        .populate("teamLeadUser", "name email uniqueID role")
        .populate("approvedBy", "name email")
        .populate("approvalHistory.actionBy", "name email role");
    }

    if (!deduction) {
      deduction = await EmployeeDeduction.findOne({ deductionRecordId: id.toUpperCase() })
        .populate("employeeId userId", "name email uniqueID role designation department")
        .populate("deductionMasterId")
        .populate("teamLeadUser", "name email uniqueID role")
        .populate("approvedBy", "name email")
        .populate("approvalHistory.actionBy", "name email role");
    }

    if (!deduction) {
      return res.status(404).json({
        success: false,
        message: "Employee Deduction record not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: deduction,
    });
  } catch (error) {
    console.error("Get Employee Deduction By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Employee Deduction",
      error: error.message,
    });
  }
};

// =====================================================
// UPDATE EMPLOYEE DEDUCTION (PROTECTED BY PAYROLL LOCKING)
// PUT /api/employee-deductions/:id
// =====================================================
const updateEmployeeDeduction = async (req, res) => {
  try {
    const { id } = req.params;

    let deduction = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deduction = await EmployeeDeduction.findById(id);
    }
    if (!deduction) {
      deduction = await EmployeeDeduction.findOne({ deductionRecordId: id.toUpperCase() });
    }

    if (!deduction) {
      return res.status(404).json({
        success: false,
        message: "Employee Deduction record not found",
      });
    }

    // Payroll Locking Check
    if (deduction.isLocked) {
      return res.status(409).json({
        success: false,
        message: "Cannot modify deduction record: it is locked to an active/finalized payroll.",
        lockedAt: deduction.lockedAt,
        monthlySalaryId: deduction.monthlySalaryId,
      });
    }

    const {
      amount,
      reason,
      remarks,
      month,
      year,
      teamLeadId,
      deductionMasterId,
      isLegallyPermissible,
    } = req.body;

    const previousAmount = deduction.amount;

    if (amount !== undefined) {
      if (Number(amount) < 0) {
        return res.status(400).json({
          success: false,
          message: "Deduction amount cannot be negative",
        });
      }
      deduction.amount = Number(amount);
    }

    if (reason !== undefined) deduction.reason = String(reason).trim();
    if (remarks !== undefined) deduction.remarks = String(remarks).trim();
    if (month !== undefined) deduction.month = Number(month);
    if (year !== undefined) deduction.year = Number(year);
    if (teamLeadId !== undefined) deduction.teamLeadId = String(teamLeadId).trim();
    if (isLegallyPermissible !== undefined) deduction.isLegallyPermissible = Boolean(isLegallyPermissible);

    if (deductionMasterId && deductionMasterId !== String(deduction.deductionMasterId)) {
      const master = await DeductionMaster.findById(deductionMasterId);
      if (!master) {
        return res.status(404).json({ success: false, message: "New Deduction Master not found" });
      }
      deduction.deductionMasterId = master._id;
      if (isLegallyPermissible === undefined) {
        deduction.isLegallyPermissible = master.isLegallyPermissible;
      }
    }

    // Record change in approval history
    deduction.approvalHistory.push({
      status: deduction.status,
      actionBy: req.user ? req.user._id : null,
      actionByName: req.user ? req.user.name : "User",
      actionRole: req.user ? req.user.role : "Editor",
      actionDate: new Date(),
      comments: `Updated record details. Previous amount: Rs.${previousAmount}, New amount: Rs.${deduction.amount}`,
      previousStatus: deduction.status,
    });

    deduction.updatedBy = req.user ? req.user._id : null;
    await deduction.save();

    await logDeductionAudit(
      req,
      "UPDATE_EMPLOYEE_DEDUCTION",
      deduction,
      `Updated Employee Deduction record ${deduction.deductionRecordId}. Amount: Rs.${deduction.amount}`
    );

    return res.status(200).json({
      success: true,
      message: "Employee Deduction updated successfully",
      data: deduction,
    });
  } catch (error) {
    console.error("Update Employee Deduction Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update Employee Deduction",
      error: error.message,
    });
  }
};

// =====================================================
// DELETE EMPLOYEE DEDUCTION (PROTECTED BY PAYROLL LOCKING)
// DELETE /api/employee-deductions/:id
// =====================================================
const deleteEmployeeDeduction = async (req, res) => {
  try {
    const { id } = req.params;

    let deduction = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deduction = await EmployeeDeduction.findById(id);
    }
    if (!deduction) {
      deduction = await EmployeeDeduction.findOne({ deductionRecordId: id.toUpperCase() });
    }

    if (!deduction) {
      return res.status(404).json({
        success: false,
        message: "Employee Deduction record not found",
      });
    }

    // Payroll Locking Check
    if (deduction.isLocked) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete deduction record: it is locked to a finalized/approved payroll.",
        lockedAt: deduction.lockedAt,
        monthlySalaryId: deduction.monthlySalaryId,
      });
    }

    await EmployeeDeduction.findByIdAndDelete(deduction._id);

    await logDeductionAudit(
      req,
      "DELETE_EMPLOYEE_DEDUCTION",
      deduction,
      `Deleted Employee Deduction record ${deduction.deductionRecordId} (Amount: Rs.${deduction.amount})`
    );

    return res.status(200).json({
      success: true,
      message: `Employee Deduction record ${deduction.deductionRecordId} deleted successfully`,
    });
  } catch (error) {
    console.error("Delete Employee Deduction Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete Employee Deduction",
      error: error.message,
    });
  }
};

// =====================================================
// APPROVE EMPLOYEE DEDUCTION
// POST /api/employee-deductions/:id/approve
// =====================================================
const approveEmployeeDeduction = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments = "" } = req.body;

    let deduction = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deduction = await EmployeeDeduction.findById(id);
    }
    if (!deduction) {
      deduction = await EmployeeDeduction.findOne({ deductionRecordId: id.toUpperCase() });
    }

    if (!deduction) {
      return res.status(404).json({
        success: false,
        message: "Employee Deduction record not found",
      });
    }

    if (deduction.isLocked) {
      return res.status(409).json({
        success: false,
        message: "Cannot alter status of a locked deduction record",
      });
    }

    const previousStatus = deduction.status;
    deduction.status = "Approved";
    deduction.approvedAt = new Date();
    deduction.approvedBy = req.user ? req.user._id : null;
    deduction.rejectionReason = "";

    deduction.approvalHistory.push({
      status: "Approved",
      actionBy: req.user ? req.user._id : null,
      actionByName: req.user ? req.user.name : "Approver",
      actionRole: req.user ? req.user.role : "Admin/TeamLead",
      actionDate: new Date(),
      comments: comments || "Deduction approved for payroll integration",
      previousStatus,
    });

    deduction.updatedBy = req.user ? req.user._id : null;
    await deduction.save();

    await logDeductionAudit(
      req,
      "APPROVE_EMPLOYEE_DEDUCTION",
      deduction,
      `Approved Employee Deduction record ${deduction.deductionRecordId} (Amount: Rs.${deduction.amount})`
    );

    return res.status(200).json({
      success: true,
      message: "Employee Deduction approved successfully",
      data: deduction,
    });
  } catch (error) {
    console.error("Approve Employee Deduction Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve Employee Deduction",
      error: error.message,
    });
  }
};

// =====================================================
// REJECT EMPLOYEE DEDUCTION
// POST /api/employee-deductions/:id/reject
// =====================================================
const rejectEmployeeDeduction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason: rejectionReason = "", comments = "" } = req.body;

    let deduction = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deduction = await EmployeeDeduction.findById(id);
    }
    if (!deduction) {
      deduction = await EmployeeDeduction.findOne({ deductionRecordId: id.toUpperCase() });
    }

    if (!deduction) {
      return res.status(404).json({
        success: false,
        message: "Employee Deduction record not found",
      });
    }

    if (deduction.isLocked) {
      return res.status(409).json({
        success: false,
        message: "Cannot reject a locked deduction record associated with finalized payroll",
      });
    }

    const previousStatus = deduction.status;
    deduction.status = "Rejected";
    deduction.rejectionReason = rejectionReason || comments || "Rejected by reviewer";

    deduction.approvalHistory.push({
      status: "Rejected",
      actionBy: req.user ? req.user._id : null,
      actionByName: req.user ? req.user.name : "Reviewer",
      actionRole: req.user ? req.user.role : "Admin/TeamLead",
      actionDate: new Date(),
      comments: deduction.rejectionReason,
      previousStatus,
    });

    deduction.updatedBy = req.user ? req.user._id : null;
    await deduction.save();

    await logDeductionAudit(
      req,
      "REJECT_EMPLOYEE_DEDUCTION",
      deduction,
      `Rejected Employee Deduction record ${deduction.deductionRecordId}. Reason: ${deduction.rejectionReason}`
    );

    return res.status(200).json({
      success: true,
      message: "Employee Deduction rejected",
      data: deduction,
    });
  } catch (error) {
    console.error("Reject Employee Deduction Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject Employee Deduction",
      error: error.message,
    });
  }
};

// =====================================================
// BATCH APPROVE DEDUCTIONS
// POST /api/employee-deductions/batch-approve
// =====================================================
const batchApproveDeductions = async (req, res) => {
  try {
    const { deductionIds, comments = "Batch approved" } = req.body;

    if (!Array.isArray(deductionIds) || deductionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "deductionIds must be a non-empty array",
      });
    }

    const records = await EmployeeDeduction.find({
      _id: { $in: deductionIds },
      isLocked: false,
    });

    let approvedCount = 0;
    for (const record of records) {
      const prev = record.status;
      record.status = "Approved";
      record.approvedAt = new Date();
      record.approvedBy = req.user ? req.user._id : null;
      record.rejectionReason = "";
      record.approvalHistory.push({
        status: "Approved",
        actionBy: req.user ? req.user._id : null,
        actionByName: req.user ? req.user.name : "Approver",
        actionRole: req.user ? req.user.role : "Admin",
        actionDate: new Date(),
        comments,
        previousStatus: prev,
      });
      await record.save();
      approvedCount += 1;
    }

    await logDeductionAudit(
      req,
      "BATCH_APPROVE_EMPLOYEE_DEDUCTIONS",
      { companyId: req.user?.companyId },
      `Batch approved ${approvedCount} employee deductions`
    );

    return res.status(200).json({
      success: true,
      message: `Successfully approved ${approvedCount} deduction record(s)`,
      count: approvedCount,
    });
  } catch (error) {
    console.error("Batch Approve Deductions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to batch approve deductions",
      error: error.message,
    });
  }
};

// =====================================================
// UNLOCK EMPLOYEE DEDUCTION (ADMIN ONLY)
// POST /api/employee-deductions/:id/unlock
// =====================================================
const unlockEmployeeDeduction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Manual unlock by administrator" } = req.body;

    let deduction = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deduction = await EmployeeDeduction.findById(id);
    }
    if (!deduction) {
      deduction = await EmployeeDeduction.findOne({ deductionRecordId: id.toUpperCase() });
    }

    if (!deduction) {
      return res.status(404).json({
        success: false,
        message: "Employee Deduction record not found",
      });
    }

    deduction.isLocked = false;
    deduction.lockedAt = null;
    deduction.lockedBy = null;
    deduction.monthlySalaryId = null;

    deduction.approvalHistory.push({
      status: deduction.status,
      actionBy: req.user ? req.user._id : null,
      actionByName: req.user ? req.user.name : "Admin",
      actionRole: req.user ? req.user.role : "admin",
      actionDate: new Date(),
      comments: `Deduction unlocked: ${reason}`,
      previousStatus: deduction.status,
    });

    await deduction.save();

    await logDeductionAudit(
      req,
      "UNLOCK_EMPLOYEE_DEDUCTION",
      deduction,
      `Unlocked Employee Deduction record ${deduction.deductionRecordId}. Reason: ${reason}`
    );

    return res.status(200).json({
      success: true,
      message: "Employee Deduction unlocked successfully",
      data: deduction,
    });
  } catch (error) {
    console.error("Unlock Employee Deduction Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to unlock Employee Deduction",
      error: error.message,
    });
  }
};

// =====================================================
// PREVIEW PAYROLL WITH DEDUCTIONS (DRY RUN)
// POST /api/deductions/preview
// =====================================================
const previewPayrollWithDeductions = async (req, res) => {
  try {
    const targetEmpId = req.body?.employeeId || req.query?.employeeId || req.body?.userId || req.query?.userId;
    const month = req.body?.month || req.query?.month;
    const year = req.body?.year || req.query?.year;

    if (!targetEmpId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: "employeeId, month, and year are required for preview",
      });
    }

    const user = await resolveEmployeeUser(targetEmpId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const { calculateMonthlyPayroll } = require("../services/payrollCalculationService");

    const payrollData = await calculateMonthlyPayroll({
      user,
      month: Number(month),
      year: Number(year),
      calculationMode: req.body?.calculationMode || req.query?.calculationMode || "CALENDAR_DAYS",
      manualWorkingDays: req.body?.workingDays || req.query?.workingDays,
      manualLopDays: req.body?.lopDays || req.query?.lopDays,
      unauthorizedFullDays: req.body?.unauthorizedFullDays || req.query?.unauthorizedFullDays || req.body?.unauthorizedFullDayCount || req.query?.unauthorizedFullDayCount,
      unauthorizedHalfDays: req.body?.unauthorizedHalfDays || req.query?.unauthorizedHalfDays || req.body?.unauthorizedHalfDayCount || req.query?.unauthorizedHalfDayCount,
      approvedLeaveDays: req.body?.approvedLeaveDays || req.query?.approvedLeaveDays || req.body?.leaveDays || req.query?.leaveDays,
      extraAllowance: req.body?.extraAllowance || req.query?.extraAllowance,
      incentive: req.body?.incentive || req.query?.incentive,
      bonus: req.body?.bonus || req.body?.extraBonus || req.query?.bonus || req.query?.extraBonus,
      extraBonus: req.body?.extraBonus || req.query?.extraBonus,
      extraDeduction: req.body?.extraDeduction || req.query?.extraDeduction,
      isPenaltyApproved: req.body?.isPenaltyApproved !== undefined ? req.body.isPenaltyApproved : req.query?.isPenaltyApproved,
      options: { ...req.query, ...req.body },
    });

    return res.status(200).json({
      success: true,
      message: "Payroll preview computed successfully",
      data: {
        employee: {
          _id: user._id,
          name: user.name,
          email: user.email,
          uniqueID: user.uniqueID,
        },
        payPeriod: payrollData.payPeriod,
        structureType: payrollData.structureType,
        calculationMode: payrollData.calculationMode,
        calendarDays: payrollData.days.totalCalendarDays,
        totalCalendarDays: payrollData.days.totalCalendarDays,
        sundays: payrollData.days.sundaysCount,
        sundaysCount: payrollData.days.sundaysCount,
        saturdayHolidays: payrollData.days.saturdayHolidaysCount,
        saturdayHolidaysCount: payrollData.days.saturdayHolidaysCount,
        configuredHolidays: payrollData.days.configuredHolidaysCount,
        configuredHolidaysCount: payrollData.days.configuredHolidaysCount,
        workingDays: payrollData.days.workingDays,
        calculationDivisor: payrollData.calculationDivisor,
        perDaySalary: payrollData.perDaySalary,
        monthlySalary: payrollData.baseEarnings.monthlySalary,
        earnedBaseSalary: payrollData.earnedBaseSalary,
        gross: payrollData.grossSalary,
        grossSalary: payrollData.grossSalary,
        payableDays: payrollData.days.daysPayable,
        daysPayable: payrollData.days.daysPayable,
        presentDays: payrollData.days.presentDays,
        approvedLeaveDays: payrollData.approvedLeaveDays,
        approvedLeaveDeduction: payrollData.leaveDeductions.approvedLeaveDeduction,
        unauthorizedAbsenceDeduction: payrollData.leaveDeductions.unauthorizedAbsenceDeduction,
        penaltyDate: req.body?.penaltyDate || req.query?.penaltyDate || null,
        leaveDays: payrollData.approvedLeaveDays,
        unauthorizedFullDayCount: payrollData.unauthorizedFullDayCount,
        unauthorizedHalfDayCount: payrollData.unauthorizedHalfDayCount,
        unauthorizedFullDays: payrollData.unauthorizedFullDays,
        unauthorizedHalfDays: payrollData.unauthorizedHalfDays,
        penaltyEligibleIncidentCount: payrollData.leaveDeductions.penaltyEligibleIncidentCount,
        incidentCount: payrollData.leaveDeductions.penaltyEligibleIncidentCount,
        actualAbsenceDays: payrollData.actualAbsenceDays,
        unpaidLeaveDays: payrollData.actualAbsenceDays,
        leaveDeduction: payrollData.leaveDeduction,
        unpaidLeaveDeduction: payrollData.leaveDeduction,
        lop: payrollData.leaveDeduction,
        lopDeduction: payrollData.leaveDeduction,
        proposedPenalty: payrollData.proposedPenalty,
        proposedPenaltyAmount: payrollData.proposedPenalty,
        appliedPenalty: payrollData.appliedPenalty,
        legallyApprovedPenalties: payrollData.appliedPenalty,
        totalAppliedDeductions: payrollData.totalAppliedDeductions,
        isPenaltyApproved: payrollData.leaveDeductions.isPenaltyApproved,
        earnings: {
          basicSalary: payrollData.baseEarnings.basicSalary,
          hra: payrollData.baseEarnings.hra,
          conveyanceAllowance: payrollData.baseEarnings.conveyanceAllowance,
          specialAllowance: payrollData.baseEarnings.specialAllowance,
          dearnessAllowance: payrollData.baseEarnings.dearnessAllowance,
          otherAllowances: payrollData.baseEarnings.otherAllowances,
          fixedBonus: payrollData.baseEarnings.fixedBonus,
          grossSalary: payrollData.grossSalary,
        },
        extraEarnings: payrollData.extraEarnings,
        leaveDeductions: payrollData.leaveDeductions,
        statutoryDeductions: {
          basicForPf: payrollData.statutoryDeductions.basicForPf,
          pfDeduction: payrollData.statutoryDeductions.pfDeduction,
          esicDeduction: payrollData.statutoryDeductions.esicDeduction,
          professionalTax: payrollData.statutoryDeductions.professionalTax,
          tds: payrollData.statutoryDeductions.tds,
          fixedDeduction: payrollData.statutoryDeductions.fixedDeduction,
        },
        customDeductions: {
          approvedAndPermissible: payrollData.customDeductions.approvedAndPermissible,
          totalApprovedCustomDeductions: payrollData.customDeductions.totalApprovedCustomDeductions,
          excludedDeductions: payrollData.customDeductions.excludedDeductions || [],
        },
        summary: payrollData.summary,
        totalDeduction: payrollData.totalDeductions,
        totalDeductions: payrollData.totalDeductions,
        netSalary: payrollData.netSalary,
        employerContributions: payrollData.employerContributions,
      },
    });
  } catch (error) {
    console.error("Preview Payroll Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to compute payroll preview",
      error: error.message,
    });
  }
};

// =====================================================
// DEDUCTIONS REPORT & ANALYTICS
// GET /api/deductions/report
// =====================================================
const getDeductionsReport = async (req, res) => {
  try {
    const { month, year, companyId, branchId, category, teamLeadId, status } = req.query;

    const query = {};
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    if (companyId) query.companyId = companyId;
    if (branchId) query.branchId = branchId;
    if (teamLeadId) query.teamLeadId = teamLeadId;
    if (status) query.status = status;

    const deductions = await EmployeeDeduction.find(query)
      .populate("employeeId userId", "name email uniqueID department designation")
      .populate("deductionMasterId", "name code category isLegallyPermissible")
      .populate("teamLeadUser", "name uniqueID");

    let filtered = deductions;
    if (category) {
      filtered = deductions.filter(
        (d) => d.deductionMasterId && d.deductionMasterId.category === category
      );
    }

    let totalAmount = 0;
    let approvedAmount = 0;
    let pendingAmount = 0;
    let rejectedAmount = 0;

    const byCategory = {};
    const byTeamLead = {};

    filtered.forEach((d) => {
      const amt = Number(d.amount || 0);
      totalAmount += amt;
      if (d.status === "Approved") approvedAmount += amt;
      else if (d.status === "Pending") pendingAmount += amt;
      else if (d.status === "Rejected") rejectedAmount += amt;

      const cat = d.deductionMasterId?.category || "OTHER";
      byCategory[cat] = (byCategory[cat] || 0) + amt;

      const tl = d.teamLeadId || "Unassigned";
      byTeamLead[tl] = (byTeamLead[tl] || 0) + amt;
    });

    return res.status(200).json({
      success: true,
      reportSummary: {
        totalRecords: filtered.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        approvedAmount: Number(approvedAmount.toFixed(2)),
        pendingAmount: Number(pendingAmount.toFixed(2)),
        rejectedAmount: Number(rejectedAmount.toFixed(2)),
        byCategory,
        byTeamLead,
      },
      records: filtered,
    });
  } catch (error) {
    console.error("Get Deductions Report Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate Deductions Report",
      error: error.message,
    });
  }
};

module.exports = {
  createEmployeeDeduction,
  getEmployeeDeductions,
  getMyDeductions,
  getEmployeeDeductionById,
  updateEmployeeDeduction,
  deleteEmployeeDeduction,
  approveEmployeeDeduction,
  rejectEmployeeDeduction,
  batchApproveDeductions,
  unlockEmployeeDeduction,
  previewPayrollWithDeductions,
  getDeductionsReport,
};
