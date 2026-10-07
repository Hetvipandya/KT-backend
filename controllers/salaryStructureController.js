const mongoose = require("mongoose");
const SalaryStructure = require("../models/SalaryStructure");
const User = require("../models/User");
const Employee = require("../models/Employee");

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
    const companyId = req.query.companyId || req.params.companyId;
    const branchId = req.query.branchId || req.params.branchId;
    const employeeId = req.query.employeeId || req.params.employeeId;
    const userId = req.query.userId || req.params.userId;
    const isActive = req.query.isActive !== undefined ? req.query.isActive : req.params.isActive;

    const query = {};
    const targetEmp = employeeId || userId;
    if (targetEmp) {
      query.$or = [{ userId: targetEmp }, { employeeId: targetEmp }];
    }
    if (companyId) query.companyId = companyId;
    if (branchId) query.branchId = branchId;
    if (isActive !== undefined) {
      query.isActive = isActive === "true" || isActive === true;
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
// GET SALARY STRUCTURE BY ID, EMPLOYEE, OR COMPANY
// GET /api/salary-structures/:id
// =====================================================
const getSalaryStructureById = async (req, res) => {
  try {
    const searchId =
      req.params.id ||
      req.params.employeeId ||
      req.params.userId ||
      req.query.id ||
      req.query.employeeId ||
      req.query.userId;
    const companyId = req.params.companyId || req.query.companyId;
    const branchId = req.params.branchId || req.query.branchId;

    if (!searchId && !companyId) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID or parameter",
      });
    }

    if (searchId && !mongoose.Types.ObjectId.isValid(searchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee/user ID",
      });
    }

    if (companyId && !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid companyId",
      });
    }

    if (branchId && !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid branchId",
      });
    }

    let structure = null;

    // 1. Direct search by searchId in SalaryStructure
    if (searchId) {
      try {
        const q = SalaryStructure.findById(searchId);
        if (q && typeof q.populate === "function") {
          structure = await q.populate(
            "userId employeeId",
            "name email uniqueID role designation department"
          );
        } else {
          structure = await q;
        }
      } catch (e) {
        structure = null;
      }
    }

    // 2. If not found by direct ID, search by query with isActive: true
    if (!structure && searchId) {
      let query = {
        isActive: true,
        $or: [
          { _id: searchId },
          { userId: searchId },
          { employeeId: searchId },
        ],
      };
      if (companyId) query.companyId = companyId;
      if (branchId) query.branchId = branchId;

      try {
        const q = SalaryStructure.findOne(query);
        if (q && typeof q.populate === "function") {
          structure = await q.populate(
            "userId employeeId",
            "name email uniqueID role designation department"
          );
        } else {
          structure = await q;
        }
      } catch (e) {
        structure = null;
      }
    }

    // 3. Fallback search without isActive: true requirement
    if (!structure && searchId) {
      let query = {
        $or: [
          { _id: searchId },
          { userId: searchId },
          { employeeId: searchId },
        ],
      };
      if (companyId) query.companyId = companyId;
      if (branchId) query.branchId = branchId;

      try {
        const q = SalaryStructure.findOne(query);
        const qSorted = q && typeof q.sort === "function" ? q.sort({ effectiveFrom: -1 }) : q;
        if (qSorted && typeof qSorted.populate === "function") {
          structure = await qSorted.populate(
            "userId employeeId",
            "name email uniqueID role designation department"
          );
        } else {
          structure = await qSorted;
        }
      } catch (e) {
        structure = null;
      }
    }

    // 4. Fallback: If searchId or companyId is passed and matches by companyId
    if (!structure) {
      const targetCompanyId = companyId || searchId;
      if (targetCompanyId && mongoose.Types.ObjectId.isValid(targetCompanyId)) {
        const companyQuery = { companyId: targetCompanyId };
        if (branchId) companyQuery.branchId = branchId;

        let compQuery = SalaryStructure.find(companyQuery);
        if (compQuery && typeof compQuery.populate === "function") {
          compQuery = compQuery.populate([
            { path: "userId employeeId", select: "name email uniqueID role designation department" },
            { path: "companyId", select: "name companyName" },
            { path: "branchId", select: "branchName" },
          ]);
        }
        if (compQuery && typeof compQuery.sort === "function") {
          compQuery = compQuery.sort({ effectiveFrom: -1 });
        }

        const structuresByCompany = await compQuery;

        if (structuresByCompany && structuresByCompany.length > 0) {
          return res.status(200).json({
            success: true,
            message: "Salary structures fetched for company",
            count: structuresByCompany.length,
            data: structuresByCompany.length === 1 ? structuresByCompany[0] : structuresByCompany,
            structures: structuresByCompany,
          });
        }
      }
    }

    if (!structure && !searchId && (companyId || branchId)) {
      let query = { isActive: true };
      if (companyId) query.companyId = companyId;
      if (branchId) query.branchId = branchId;
      structure = await SalaryStructure.findOne(query);

      if (!structure) {
        delete query.isActive;
        structure = await SalaryStructure.findOne(query);
      }
    }

    // 2. If direct search did not find structure, try resolving candidate IDs from User & Employee
    let targetUserDoc = null;
    if (!structure && searchId && mongoose.connection && mongoose.connection.readyState === 1) {
      let candidateIds = [searchId];
      try {
        if (typeof User.findById === "function") {
          targetUserDoc = await User.findById(searchId);
        }
        if (typeof Employee.find === "function") {
          const empDocs = await Employee.find({
            $or: [
              { _id: searchId },
              { userId: searchId },
              { userID: searchId },
            ],
          });
          for (const emp of empDocs) {
            if (emp._id) candidateIds.push(emp._id.toString());
            if (emp.userId) candidateIds.push(emp.userId.toString());
            if (emp.userID) candidateIds.push(emp.userID.toString());
            if (!targetUserDoc && (emp.userId || emp.userID) && typeof User.findById === "function") {
              try {
                targetUserDoc = await User.findById(emp.userId || emp.userID);
              } catch (e) {}
            }
          }
        }
      } catch (e) {}

      candidateIds = [...new Set(candidateIds)];

      if (candidateIds.length > 1) {
        let query = {
          $or: [
            { _id: { $in: candidateIds } },
            { userId: { $in: candidateIds } },
            { employeeId: { $in: candidateIds } },
          ],
        };
        if (companyId) query.companyId = companyId;
        if (branchId) query.branchId = branchId;

        structure = await SalaryStructure.findOne({ ...query, isActive: true });
        if (!structure) {
          structure = await SalaryStructure.findOne(query);
        }
      }
    }

    // 3. Fallback: if user exists in DB but has no custom salary structure yet
    if (!structure && targetUserDoc) {
      const defaultStructure = {
        _id: targetUserDoc._id,
        userId: targetUserDoc._id,
        employeeId: targetUserDoc._id,
        companyId: companyId || targetUserDoc.companyId || null,
        branchId: branchId || targetUserDoc.branchId || null,
        effectiveFrom: new Date(),
        basicSalary: 0,
        hra: 0,
        conveyanceAllowance: 0,
        medicalAllowance: 0,
        specialAllowance: 0,
        dearnessAllowance: 0,
        otherAllowances: 0,
        fixedBonus: 0,
        grossSalary: 0,
        pfDeduction: 0,
        esicDeduction: 0,
        professionalTax: 0,
        tds: 0,
        tdsPercentage: 0,
        fixedDeduction: 0,
        otherDeductions: 0,
        totalDeduction: 0,
        netSalary: 0,
        employerContributions: { pf: 0, esic: 0, gratuity: 0, other: 0 },
        isActive: true,
        isDefaultFallback: true,
      };

      return res.status(200).json({
        success: true,
        data: defaultStructure,
        message: "Default salary structure for user",
      });
    }

    if (!structure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found",
      });
    }

    if (structure && typeof structure.populate === "function") {
      try {
        structure = await structure.populate([
          { path: "userId employeeId", select: "name email uniqueID role designation department" },
          { path: "companyId", select: "name companyName" },
          { path: "branchId", select: "branchName" },
        ]);
      } catch (err) {
        structure = await structure.populate(
          "userId employeeId",
          "name email uniqueID role designation department"
        );
      }
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
