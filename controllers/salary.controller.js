const mongoose = require("mongoose");
const SalaryStructure = require("../models/SalaryStructure");
const User = require("../models/User");

// =====================================================
// CREATE SALARY STRUCTURE
// POST /api/salary
// =====================================================
const createSalaryStructure = async (req, res) => {
  try {
    const {
      userId,
      basicSalary,
      hra,
      allowance,
      fixedBonus,
      fixedDeduction,
      tdsPercentage,
      isActive,
    } = req.body;

    // Required field validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    // Check User exists
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check active salary structure already exists
    const existingSalary = await SalaryStructure.findOne({
      userId,
      isActive: true,
    });

    if (existingSalary) {
      return res.status(409).json({
        success: false,
        message: "Active salary structure already exists for this user",
        data: existingSalary,
      });
    }

    const salary = new SalaryStructure({
      userId,
      basicSalary: basicSalary ?? 0,
      hra: hra ?? 0,
      allowance: allowance ?? 0,
      fixedBonus: fixedBonus ?? 0,
      fixedDeduction: fixedDeduction ?? 0,
      tdsPercentage: tdsPercentage ?? 0,
      isActive: isActive ?? true,
    });

    await salary.save();

    const populatedSalary = await SalaryStructure.findById(salary._id)
      .populate("userId", "name email uniqueID role");

    return res.status(201).json({
      success: true,
      message: "Salary structure created successfully",
      data: populatedSalary,
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
// GET /api/salary
// =====================================================
const getAllSalaryStructures = async (req, res) => {
  try {
    const salaries = await SalaryStructure.find()
      .populate("userId", "name email uniqueID role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Salary structures fetched successfully",
      count: salaries.length,
      data: salaries,
    });
  } catch (error) {
    console.error("Get All Salary Structures Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch salary structures",
      error: error.message,
    });
  }
};


// =====================================================
// GET SALARY STRUCTURE BY ID
// GET /api/salary/:id
// =====================================================
const getSalaryStructureById = async (req, res) => {
  try {
    const id = req.params.id || req.params.userId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary structure ID or User ID",
      });
    }

    // 1. Try finding by SalaryStructure _id
    let salary = await SalaryStructure.findById(id)
      .populate("userId", "name email uniqueID role");

    // 2. Try finding active SalaryStructure by userId or employeeId
    if (!salary) {
      salary = await SalaryStructure.findOne({
        $or: [{ userId: id }, { employeeId: id }],
        isActive: true,
      }).populate("userId", "name email uniqueID role");
    }

    // 3. Try finding any SalaryStructure by userId or employeeId
    if (!salary) {
      salary = await SalaryStructure.findOne({
        $or: [{ userId: id }, { employeeId: id }],
      })
        .sort({ createdAt: -1 })
        .populate("userId", "name email uniqueID role");
    }

    // 4. Try finding in Finance Salary model (models/Salary.js)
    if (!salary) {
      try {
        const Salary = require("../models/Salary");
        const finSalary = await Salary.findById(id).lean();
        if (finSalary) {
          return res.status(200).json({
            success: true,
            message: "Salary record fetched successfully",
            data: finSalary,
          });
        }
      } catch (err) {}
    }

    // 5. Fallback: If User or Employee exists, return default salary structure
    if (!salary) {
      try {
        const user = await User.findById(id).lean();
        const Employee = require("../models/Employee");
        const emp = await Employee.findOne({ $or: [{ _id: id }, { userID: id }] }).lean();

        if (user || emp) {
          salary = {
            _id: null,
            userId: user?._id || emp?.userID || emp?._id || id,
            basicSalary: 0,
            hra: 0,
            allowance: 0,
            fixedBonus: 0,
            fixedDeduction: 0,
            tdsPercentage: 0,
            grossSalary: 0,
            totalDeduction: 0,
            netSalary: 0,
            isActive: true,
            user: user || emp || null
          };
          return res.status(200).json({
            success: true,
            message: "Default salary structure returned",
            data: salary,
          });
        }
      } catch (err) {}
    }

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Salary structure fetched successfully",
      data: salary,
    });
  } catch (error) {
    console.error("Get Salary Structure By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch salary structure",
      error: error.message,
    });
  }
};


// =====================================================
// PUT - FULL UPDATE
// PUT /api/salary/:id
// =====================================================
const updateSalaryStructure = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary structure ID",
      });
    }

    const salary = await SalaryStructure.findById(id);

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found",
      });
    }

    const {
      userId,
      basicSalary,
      hra,
      allowance,
      fixedBonus,
      fixedDeduction,
      tdsPercentage,
      isActive,
    } = req.body;

    // PUT = full update
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required for PUT request",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If changing userId, check active salary structure
    if (userId.toString() !== salary.userId.toString()) {
      const existingSalary = await SalaryStructure.findOne({
        userId,
        isActive: true,
        _id: { $ne: salary._id },
      });

      if (existingSalary) {
        return res.status(409).json({
          success: false,
          message: "Active salary structure already exists for this user",
        });
      }
    }

    salary.userId = userId;
    salary.basicSalary = basicSalary ?? 0;
    salary.hra = hra ?? 0;
    salary.allowance = allowance ?? 0;
    salary.fixedBonus = fixedBonus ?? 0;
    salary.fixedDeduction = fixedDeduction ?? 0;
    salary.tdsPercentage = tdsPercentage ?? 0;
    salary.isActive = isActive ?? true;

    // Important: save() triggers pre-save calculation
    await salary.save();

    const updatedSalary = await SalaryStructure.findById(salary._id)
      .populate("userId", "name email uniqueID role");

    return res.status(200).json({
      success: true,
      message: "Salary structure updated successfully",
      data: updatedSalary,
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
// PATCH - PARTIAL UPDATE
// PATCH /api/salary/:id
// =====================================================
const patchSalaryStructure = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary structure ID",
      });
    }

    const salary = await SalaryStructure.findById(id);

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found",
      });
    }

    const allowedFields = [
      "userId",
      "basicSalary",
      "hra",
      "allowance",
      "fixedBonus",
      "fixedDeduction",
      "tdsPercentage",
      "isActive",
    ];

    // Update only fields provided in request
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        salary[field] = req.body[field];
      }
    }

    // Validate userId if changed
    if (req.body.userId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid userId",
        });
      }

      const user = await User.findById(req.body.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const existingSalary = await SalaryStructure.findOne({
        userId: req.body.userId,
        isActive: true,
        _id: { $ne: salary._id },
      });

      if (existingSalary && salary.isActive === true) {
        return res.status(409).json({
          success: false,
          message: "Active salary structure already exists for this user",
        });
      }
    }

    // save() triggers pre-save and recalculates gross/net salary
    await salary.save();

    const updatedSalary = await SalaryStructure.findById(salary._id)
      .populate("userId", "name email uniqueID role");

    return res.status(200).json({
      success: true,
      message: "Salary structure partially updated successfully",
      data: updatedSalary,
    });
  } catch (error) {
    console.error("Patch Salary Structure Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to partially update salary structure",
      error: error.message,
    });
  }
};


// =====================================================
// DELETE SALARY STRUCTURE
// DELETE /api/salary/:id
// =====================================================
const deleteSalaryStructure = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary structure ID",
      });
    }

    const salary = await SalaryStructure.findById(id);

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found",
      });
    }

    await SalaryStructure.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Salary structure deleted successfully",
      data: {
        deletedId: id,
      },
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
  patchSalaryStructure,
  deleteSalaryStructure,
};