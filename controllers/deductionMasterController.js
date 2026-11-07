const mongoose = require("mongoose");
const DeductionMaster = require("../models/DeductionMaster");
const EmployeeDeduction = require("../models/EmployeeDeduction");
const { logDeductionAudit } = require("../services/deduction.service");

// =====================================================
// CREATE DEDUCTION MASTER
// POST /api/deduction-masters
// =====================================================
const createDeductionMaster = async (req, res) => {
  try {
    const {
      name,
      code,
      category = "VOLUNTARY",
      description = "",
      calculationType = "FLAT",
      defaultAmount = 0,
      percentage = 0,
      percentageBasis = "GROSS_SALARY",
      isLegallyPermissible = true,
      legalReference = "",
      maxDeductionPercent = 50,
      isActive = true,
      companyId,
      branchId,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Deduction name is required",
      });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Deduction code is required",
      });
    }

    const cleanCode = code.trim().toUpperCase();

    // Check for duplicate code
    const existingMaster = await DeductionMaster.findOne({
      code: cleanCode,
      ...(companyId ? { companyId } : {}),
    });

    if (existingMaster) {
      return res.status(409).json({
        success: false,
        message: `Deduction master with code "${cleanCode}" already exists`,
      });
    }

    const master = new DeductionMaster({
      name: name.trim(),
      code: cleanCode,
      category,
      description: description.trim(),
      calculationType,
      defaultAmount: Number(defaultAmount) || 0,
      percentage: Number(percentage) || 0,
      percentageBasis,
      isLegallyPermissible: Boolean(isLegallyPermissible),
      legalReference: legalReference.trim(),
      maxDeductionPercent: Number(maxDeductionPercent) || 50,
      isActive: isActive !== false,
      companyId: companyId || req.user?.companyId || null,
      branchId: branchId || req.user?.branchId || null,
      createdBy: req.user ? req.user._id : null,
      updatedBy: req.user ? req.user._id : null,
    });

    await master.save();

    await logDeductionAudit(
      req,
      "CREATE_DEDUCTION_MASTER",
      master,
      `Created Deduction Master "${master.name}" (${master.code})`
    );

    return res.status(201).json({
      success: true,
      message: "Deduction Master created successfully",
      data: master,
    });
  } catch (error) {
    console.error("Create Deduction Master Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create Deduction Master",
      error: error.message,
    });
  }
};

// =====================================================
// GET ALL DEDUCTION MASTERS
// GET /api/deduction-masters
// =====================================================
const getDeductionMasters = async (req, res) => {
  try {
    const {
      category,
      isActive,
      isLegallyPermissible,
      search,
      companyId,
      branchId,
    } = req.query;

    const query = {};

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === "true" || isActive === true;
    if (isLegallyPermissible !== undefined) {
      query.isLegallyPermissible = isLegallyPermissible === "true" || isLegallyPermissible === true;
    }
    if (companyId) query.companyId = companyId;
    if (branchId) query.branchId = branchId;

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [{ name: searchRegex }, { code: searchRegex }, { description: searchRegex }];
    }

    const masters = await DeductionMaster.find(query)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: masters.length,
      data: masters,
    });
  } catch (error) {
    console.error("Get Deduction Masters Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Deduction Masters",
      error: error.message,
    });
  }
};

// =====================================================
// GET DEDUCTION MASTER BY ID
// GET /api/deduction-masters/:id
// =====================================================
const getDeductionMasterById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Deduction Master ID",
      });
    }

    const master = await DeductionMaster.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!master) {
      return res.status(404).json({
        success: false,
        message: "Deduction Master not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: master,
    });
  } catch (error) {
    console.error("Get Deduction Master Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Deduction Master",
      error: error.message,
    });
  }
};

// =====================================================
// UPDATE DEDUCTION MASTER
// PUT /api/deduction-masters/:id
// =====================================================
const updateDeductionMaster = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Deduction Master ID",
      });
    }

    const master = await DeductionMaster.findById(id);
    if (!master) {
      return res.status(404).json({
        success: false,
        message: "Deduction Master not found",
      });
    }

    const {
      name,
      code,
      category,
      description,
      calculationType,
      defaultAmount,
      percentage,
      percentageBasis,
      isLegallyPermissible,
      legalReference,
      maxDeductionPercent,
      isActive,
    } = req.body;

    if (code && code.trim().toUpperCase() !== master.code) {
      const cleanCode = code.trim().toUpperCase();
      const duplicate = await DeductionMaster.findOne({
        _id: { $ne: id },
        code: cleanCode,
        ...(master.companyId ? { companyId: master.companyId } : {}),
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Deduction master with code "${cleanCode}" already exists`,
        });
      }
      master.code = cleanCode;
    }

    if (name) master.name = name.trim();
    if (category) master.category = category;
    if (description !== undefined) master.description = description.trim();
    if (calculationType) master.calculationType = calculationType;
    if (defaultAmount !== undefined) master.defaultAmount = Number(defaultAmount);
    if (percentage !== undefined) master.percentage = Number(percentage);
    if (percentageBasis) master.percentageBasis = percentageBasis;
    if (isLegallyPermissible !== undefined) master.isLegallyPermissible = Boolean(isLegallyPermissible);
    if (legalReference !== undefined) master.legalReference = legalReference.trim();
    if (maxDeductionPercent !== undefined) master.maxDeductionPercent = Number(maxDeductionPercent);
    if (isActive !== undefined) master.isActive = Boolean(isActive);

    master.updatedBy = req.user ? req.user._id : null;
    await master.save();

    await logDeductionAudit(
      req,
      "UPDATE_DEDUCTION_MASTER",
      master,
      `Updated Deduction Master "${master.name}" (${master.code})`
    );

    return res.status(200).json({
      success: true,
      message: "Deduction Master updated successfully",
      data: master,
    });
  } catch (error) {
    console.error("Update Deduction Master Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update Deduction Master",
      error: error.message,
    });
  }
};

// =====================================================
// DELETE DEDUCTION MASTER
// DELETE /api/deduction-masters/:id
// =====================================================
const deleteDeductionMaster = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Deduction Master ID",
      });
    }

    const master = await DeductionMaster.findById(id);
    if (!master) {
      return res.status(404).json({
        success: false,
        message: "Deduction Master not found",
      });
    }

    // Check if referenced by any active/approved employee deductions
    const inUse = await EmployeeDeduction.exists({ deductionMasterId: id });
    if (inUse) {
      // Soft deactivate to maintain integrity of existing records
      master.isActive = false;
      master.updatedBy = req.user ? req.user._id : null;
      await master.save();

      await logDeductionAudit(
        req,
        "DEACTIVATE_DEDUCTION_MASTER",
        master,
        `Deactivated Deduction Master "${master.name}" (${master.code}) as it is linked to employee deduction records`
      );

      return res.status(200).json({
        success: true,
        message: "Deduction Master is in use by employee deductions; it has been marked as inactive rather than deleted.",
        data: master,
      });
    }

    await DeductionMaster.findByIdAndDelete(id);

    await logDeductionAudit(
      req,
      "DELETE_DEDUCTION_MASTER",
      master,
      `Deleted Deduction Master "${master.name}" (${master.code})`
    );

    return res.status(200).json({
      success: true,
      message: "Deduction Master deleted successfully",
    });
  } catch (error) {
    console.error("Delete Deduction Master Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete Deduction Master",
      error: error.message,
    });
  }
};

module.exports = {
  createDeductionMaster,
  getDeductionMasters,
  getDeductionMasterById,
  updateDeductionMaster,
  deleteDeductionMaster,
};
