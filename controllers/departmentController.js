const mongoose =
  require("mongoose");

const Department =
  require("../models/Department");

const Team =
  require("../models/Team");

// ================= CREATE DEPARTMENT =================
exports.createDepartment = async (req, res) => {
  try {
    const departments = req.body;

    if (!Array.isArray(departments)) {
      return res.status(400).json({
        success: false,
        message: "Send array of departments"
      });
    }

    for (const dept of departments) {
      if (!dept.departmentName) {
        return res.status(400).json({
          success: false,
          message: "Department name is required"
        });
      }
    }

    const createdDepartments =
      await Department.insertMany(departments);

    return res.status(201).json({
      success: true,
      message: "Departments created successfully",
      data: createdDepartments
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ================= GET ALL DEPARTMENTS =================
exports.getDepartmentList =
  async (req, res) => {
    try {
      const departments =
        await Department.find()
          .populate(
            "departmentHead",
            "fullName email"
          )
          .populate(
            "teams"
          )
          .sort({
            createdAt: -1,
          });

      return res
        .status(200)
        .json({
          success: true,
          count:
            departments.length,
          data: departments,
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };

// ================= UPDATE DEPARTMENT =================
exports.updateDepartment =
  async (req, res) => {
    try {
      const {
        departmentID,
        departmentName,
        departmentHead,
        departmentBudget,
        teams,
        description,
        status,
      } = req.body;

      if (!departmentID) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Department ID required",
          });
      }

      const department =
        await Department.findById(
          departmentID
        );

      if (!department) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Department not found",
          });
      }

      // Duplicate Name Check
      if (
        departmentName
      ) {
        const existDepartment =
          await Department.findOne({
            departmentName,
            _id: {
              $ne:
                departmentID,
            },
          });

        if (
          existDepartment
        ) {
          return res
            .status(400)
            .json({
              success:
                false,
              message:
                "Department name already exists",
            });
        }

        department.departmentName =
          departmentName;
      }

      // Update Head
      if (
        departmentHead
      ) {
        department.departmentHead =
          departmentHead;
      }

      // Update Budget
      if (
        departmentBudget !==
        undefined
      ) {
        department.departmentBudget =
          departmentBudget;
      }

      // Update Teams
      if (
        teams
      ) {
        // Remove old departmentId
        await Team.updateMany(
          {
            _id: {
              $in:
                department.teams,
            },
          },
          {
            $set: {
              departmentId:
                null,
            },
          }
        );

        // Add new departmentId
        await Team.updateMany(
          {
            _id: {
              $in:
                teams,
            },
          },
          {
            $set: {
              departmentId:
                departmentID,
            },
          }
        );

        department.teams =
          teams;
      }

      // Description
      if (
        description !==
        undefined
      ) {
        department.description =
          description;
      }

      // Status
      if (
        status !==
        undefined
      ) {
        department.status =
          status;
      }

      await department.save();

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Department updated successfully",
          data: department,
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message:
            error.message,
        });
    }
  };