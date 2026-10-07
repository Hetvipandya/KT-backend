const mongoose = require("mongoose");
const SalaryStructure = require("../models/SalaryStructure");
const User = require("../models/User");

// =====================================================
// CREATE SALARY STRUCTURE
// POST /api/salary-structures
// =====================================================
const createSalaryStructure = async (req, res) => {
  try {
    const {
      employeeId,
      userId,
      companyId, 
      branchId,
      financialYearId,
      effectiveFrom,
      basicSalary,
      hra,
      conveyanceAllowance,
      medicalAllowance,
      specialAllowance,
      allowance,
      dearnessAllowance,
      da,
      otherAllowances,
      fixedBonus,
      pfDeduction,
      esicDeduction,
      professionalTax,
      tds,
      tdsPercentage,
      fixedDeduction,
      otherDeductions,
      employerContributions,
      yearsOfService,
      autoCalculateStatutory,
      isActive,
    } = req.body;

    const targetUserId = employeeId || userId;
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "employeeId or userId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employeeId",
      });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Rule: Only one active salary structure per employee at a time.
    if (isActive !== false) {
      await SalaryStructure.updateMany(
        {
          $or: [{ userId: targetUserId }, { employeeId: targetUserId }],
          isActive: true,
        },
        { $set: { isActive: false } }
      );
    }

    const salaryStructure = new SalaryStructure({
      userId: targetUserId,
      employeeId: targetUserId,
      companyId: companyId || user.companyId || null,
      branchId: branchId || user.branchId || null,
      financialYearId: financialYearId || null,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      basicSalary: basicSalary ?? 0,
      hra: hra ?? 0,
      conveyanceAllowance: conveyanceAllowance ?? 0,
      medicalAllowance: medicalAllowance ?? 0,
      specialAllowance: specialAllowance ?? allowance ?? 0,
      dearnessAllowance: dearnessAllowance ?? da ?? 0,
      otherAllowances: otherAllowances ?? 0,
      fixedBonus: fixedBonus ?? 0,
      pfDeduction: pfDeduction ?? 0,
      esicDeduction: esicDeduction ?? 0,
      professionalTax: professionalTax ?? 0,
      tds: tds ?? 0,
      tdsPercentage: tdsPercentage ?? 0,
      fixedDeduction: fixedDeduction ?? 0,
      otherDeductions: otherDeductions ?? 0,
      employerContributions: employerContributions || { pf: 0, esic: 0, gratuity: 0, other: 0 },
      yearsOfService: yearsOfService ?? 1,
      autoCalculateStatutory: autoCalculateStatutory ?? true,
      isActive: isActive ?? true,
      createdBy: req.user ? req.user._id : null,
      updatedBy: req.user ? req.user._id : null,
    });

    await salaryStructure.save();

    let populatedStructure = await SalaryStructure.findById(salaryStructure._id);
    if (populatedStructure && typeof populatedStructure.populate === "function") {
      populatedStructure = await populatedStructure.populate(
        "userId employeeId",
        "name email uniqueID role designation department"
      );
    }

    return res.status(201).json({
      success: true,
      message: "Salary structure created successfully with HR Payroll Formula calculations",
      data: populatedStructure || salaryStructure,
    });
  } catch (error) {
    console.error("Create Salary Structure Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create salary structure",
      error: error.message,
    });
  }
};

// =====================================================
// GET ALL SALARY STRUCTURES
// GET /api/salary-structures
// =====================================================
const getAllSalaryStructures = async (req, res) => {
  try {
    const { employeeId, userId, companyId, branchId, isActive } = req.query;

    const query = {};
    const targetEmp = employeeId || userId;
    if (targetEmp) {
      query.$or = [{ userId: targetEmp }, { employeeId: targetEmp }];
    }
    if (companyId) query.companyId = companyId;
    if (branchId) query.branchId = branchId;
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const structures = await SalaryStructure.find(query)
      .populate("userId employeeId", "name email uniqueID role designation department")
      .sort({ effectiveFrom: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: structures.length,
      data: structures,
    });
  } catch (error) {
    console.error("Get Salary Structures Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch salary structures",
      error: error.message,
    });
  }
};

// =====================================================
// GET SALARY STRUCTURE BY ID OR EMPLOYEE
// GET /api/salary-structures/:id
// =====================================================
const getSalaryStructureById = async (req, res) => {
  try {
    const { companyId, branchId, id, employeeId, userId } = req.params;

    // Validate companyId
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid companyId",
      });
    }

    // Validate branchId
    if (!branchId || !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branchId",
      });
    }

    // Find salary structure using companyId + branchId
    let query = {
      companyId,
      branchId,
      isActive: true,
    };

    // If employee/user/id is provided, also filter by it
    const searchId = id || employeeId || userId;

    if (searchId) {
      if (!mongoose.Types.ObjectId.isValid(searchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee/user ID",
        });
      }

      query.$or = [
        { _id: searchId },
        { userId: searchId },
        { employeeId: searchId },
      ];
    }

    let structure = await SalaryStructure.findOne(query)
      .populate(
        "userId employeeId",
        "name email uniqueID role designation department"
      )
      .sort({ effectiveFrom: -1 });

    if (!structure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found for this company and branch",
      });
    }

    return res.status(200).json({
      success: true,
      data: structure,
    });
  } catch (error) {
    console.error("Get Salary Structure Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch salary structure",
      error: error.message,
    });
  }
};

// =====================================================
// UPDATE SALARY STRUCTURE
// PUT /api/salary-structures/:id OR PUT /api/payroll/update-salary/:id
// =====================================================
const updateSalaryStructure = async (req, res) => {
  try {
    const id = req.params.id || req.params.employeeId || req.params.userId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    }

    let existingStructure = await SalaryStructure.findById(id);

    if (!existingStructure) {
      existingStructure = await SalaryStructure.findOne({
        $or: [{ userId: id }, { employeeId: id }],
        isActive: true,
      });
    }

    if (!existingStructure) {
      existingStructure = await SalaryStructure.findOne({
        $or: [{ userId: id }, { employeeId: id }],
      }).sort({ effectiveFrom: -1, createdAt: -1 });
    }

    if (!existingStructure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found",
      });
    }

    const {
      createNewVersion = false,
      effectiveFrom,
      basicSalary,
      hra,
      conveyanceAllowance,
      medicalAllowance,
      specialAllowance,
      allowance,
      dearnessAllowance,
      da,
      otherAllowances,
      fixedBonus,
      pfDeduction,
      esicDeduction,
      professionalTax,
      tds,
      tdsPercentage,
      fixedDeduction,
      otherDeductions,
      employerContributions,
      yearsOfService,
      autoCalculateStatutory,
      isActive,
    } = req.body;

    if (createNewVersion && existingStructure.isActive) {
      existingStructure.isActive = false;
      await existingStructure.save();

      const newStructure = new SalaryStructure({
        userId: existingStructure.userId,
        employeeId: existingStructure.employeeId,
        companyId: existingStructure.companyId,
        branchId: existingStructure.branchId,
        financialYearId: existingStructure.financialYearId,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        basicSalary: basicSalary ?? existingStructure.basicSalary,
        hra: hra ?? existingStructure.hra,
        conveyanceAllowance: conveyanceAllowance ?? existingStructure.conveyanceAllowance,
        medicalAllowance: medicalAllowance ?? existingStructure.medicalAllowance,
        specialAllowance: specialAllowance ?? allowance ?? existingStructure.specialAllowance,
        dearnessAllowance: dearnessAllowance ?? da ?? existingStructure.dearnessAllowance,
        otherAllowances: otherAllowances ?? existingStructure.otherAllowances,
        fixedBonus: fixedBonus ?? existingStructure.fixedBonus,
        pfDeduction: pfDeduction ?? existingStructure.pfDeduction,
        esicDeduction: esicDeduction ?? existingStructure.esicDeduction,
        professionalTax: professionalTax ?? existingStructure.professionalTax,
        tds: tds ?? existingStructure.tds,
        tdsPercentage: tdsPercentage ?? existingStructure.tdsPercentage,
        fixedDeduction: fixedDeduction ?? existingStructure.fixedDeduction,
        otherDeductions: otherDeductions ?? existingStructure.otherDeductions,
        employerContributions: employerContributions || existingStructure.employerContributions,
        yearsOfService: yearsOfService ?? existingStructure.yearsOfService,
        autoCalculateStatutory: autoCalculateStatutory ?? existingStructure.autoCalculateStatutory,
        isActive: isActive ?? true,
        createdBy: req.user ? req.user._id : existingStructure.createdBy,
        updatedBy: req.user ? req.user._id : null,
      });

      await newStructure.save();

      let populatedNew = await SalaryStructure.findById(newStructure._id);
      if (populatedNew && typeof populatedNew.populate === "function") {
        populatedNew = await populatedNew.populate(
          "userId employeeId",
          "name email uniqueID role designation department"
        );
      }

      return res.status(200).json({
        success: true,
        message: "New active salary structure version created successfully",
        data: populatedNew || newStructure,
      });
    }

    // Direct in-place update
    if (basicSalary !== undefined) existingStructure.basicSalary = basicSalary;
    if (hra !== undefined) existingStructure.hra = hra;
    if (conveyanceAllowance !== undefined) existingStructure.conveyanceAllowance = conveyanceAllowance;
    if (medicalAllowance !== undefined) existingStructure.medicalAllowance = medicalAllowance;
    if (specialAllowance !== undefined || allowance !== undefined)
      existingStructure.specialAllowance = specialAllowance ?? allowance;
    if (dearnessAllowance !== undefined || da !== undefined)
      existingStructure.dearnessAllowance = dearnessAllowance ?? da;
    if (otherAllowances !== undefined) existingStructure.otherAllowances = otherAllowances;
    if (fixedBonus !== undefined) existingStructure.fixedBonus = fixedBonus;
    if (pfDeduction !== undefined) existingStructure.pfDeduction = pfDeduction;
    if (esicDeduction !== undefined) existingStructure.esicDeduction = esicDeduction;
    if (professionalTax !== undefined) existingStructure.professionalTax = professionalTax;
    if (tds !== undefined) existingStructure.tds = tds;
    if (tdsPercentage !== undefined) existingStructure.tdsPercentage = tdsPercentage;
    if (fixedDeduction !== undefined) existingStructure.fixedDeduction = fixedDeduction;
    if (otherDeductions !== undefined) existingStructure.otherDeductions = otherDeductions;
    if (employerContributions !== undefined) existingStructure.employerContributions = employerContributions;
    if (yearsOfService !== undefined) existingStructure.yearsOfService = yearsOfService;
    if (autoCalculateStatutory !== undefined) existingStructure.autoCalculateStatutory = autoCalculateStatutory;
    if (effectiveFrom) existingStructure.effectiveFrom = new Date(effectiveFrom);
    if (isActive !== undefined) existingStructure.isActive = isActive;
    if (req.user) existingStructure.updatedBy = req.user._id;

    await existingStructure.save();

    let populatedUpdated = await SalaryStructure.findById(existingStructure._id);
    if (populatedUpdated && typeof populatedUpdated.populate === "function") {
      populatedUpdated = await populatedUpdated.populate(
        "userId employeeId",
        "name email uniqueID role designation department"
      );
    }

    return res.status(200).json({
      success: true,
      message: "Salary structure updated successfully",
      data: populatedUpdated || existingStructure,
    });
  } catch (error) {
    console.error("Update Salary Structure Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update salary structure",
      error: error.message,
    });
  }
};

// =====================================================
// DELETE SALARY STRUCTURE (SOFT DELETE / DEACTIVATE)
// DELETE /api/salary-structures/:id
// =====================================================
const deleteSalaryStructure = async (req, res) => {
  try {
    const id = req.params.id || req.params.employeeId || req.params.userId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    }

    const structure = await SalaryStructure.findById(id);
    if (!structure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found",
      });
    }

    structure.isActive = false;
    await structure.save();

    return res.status(200).json({
      success: true,
      message: "Salary structure deactivated successfully",
      data: structure,
    });
  } catch (error) {
    console.error("Delete Salary Structure Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete salary structure",
      error: error.message,
    });
  }
};

module.exports = {
  createSalaryStructure,
  getAllSalaryStructures,
  getSalaryStructureById,
  updateSalaryStructure,
  deleteSalaryStructure,
};
