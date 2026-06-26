const Employee =
  require("../models/Employee");

const EmployeeDocument =
  require(
    "../models/EmployeeDocument"
  ); 

const EmployeeHistory =
  require(
    "../models/EmployeeHistory"
  );


// ================= GENERATE EMPLOYEE ID =================
const generateEmployeeID =
  async () => {
    const count =
      await Employee.countDocuments();

    return `EMP${String(
      count + 1
    ).padStart(4, "0")}`;
  };
 
// ================= ADD EMPLOYEE =================
exports.addEmployee =
  async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        mobile,
        department,
        designation,
        teamLead,
      } = req.body;

      // VALIDATION
      if (
          !firstName ||
  !email ||
  !mobile ||
  !designation
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "First name, email, mobile and designation are required",
          });
      }

      // CHECK EMPLOYEE EXISTS
      const existEmployee =
        await Employee.findOne({
          email,
        });

      if (
        existEmployee
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Employee already exists",
          });
      }

      // GENERATE EMPLOYEE ID
      const employeeID =
        await generateEmployeeID();

      // CREATE EMPLOYEE
      const employee =
        await Employee.create({
          ...req.body,
          employeeID,
           currentAction: "created",
        });

      // FILES
      const files =
        req.files || {};

      // CREATE DOCUMENTS
      const employeeDocuments =
        await EmployeeDocument.create(
          {
            employeeID:
              employee._id,

            aadharCard:
              files
                ?.aadharCard?.[0]
                ?.filename ||
              "",

            panCard:
              files
                ?.panCard?.[0]
                ?.filename ||
              "",

            resume:
              files
                ?.resume?.[0]
                ?.filename ||
              "",

            offerLetter:
              files
                ?.offerLetter?.[0]
                ?.filename ||
              "",

            joiningLetter:
              files
                ?.joiningLetter?.[0]
                ?.filename ||
              "",

            certificates:
              files
                ?.certificates?.map(
                  (
                    file
                  ) =>
                    file.filename
                ) || [],
          }
        );

      // CREATE HISTORY
      await EmployeeHistory.create({
  employeeID: employee._id,
  action: "created",
  message: `${firstName} ${lastName} added`,
});

      res.status(201).json({
        success: true,
        message:
          "Employee added successfully",
        employee,
        documents:
          employeeDocuments,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

  exports.getAllEmployeeHistory = async (req, res) => {
  try {
    const history = await EmployeeHistory.find()
      .populate("employeeID")
      .populate("actionBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= EMPLOYEE LIST =================
exports.getEmployeeList = async (req, res) => {
  try {
    const employees = await Employee.find()
      .populate(
        "department",
        "departmentName"
      )
      .populate(
        "teamLead",
        "firstName lastName email"
      )
      .sort({ createdAt: -1 });

 const employeeList = employees.map(
  (emp) => ({
    ...emp.toObject(),

    currentAction:
      emp.currentAction || "created",

    departmentName:
      emp.department?.departmentName || "",

    designationName:
      emp.designation || "",
  })
);

    res.status(200).json({
      success: true,
      total: employeeList.length,
      employees: employeeList,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= EMPLOYEE PROFILE =================
exports.getEmployeeProfile =
  async (req, res) => {
    try {
      const employee =
        await Employee.findById(
          req.params.id
        )
          .populate(
            "department"
          )
          .populate(
            "teamLead",
            "firstName lastName email"
          );

      if (
        !employee
      ) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Employee not found",
          });
      }

      const documents =
        await EmployeeDocument.findOne(
          {
            employeeID:
              req.params.id,
          }
        );

      const history =
        await EmployeeHistory.find(
          {
            employeeID:
              req.params.id,
          }
        ).sort({
          createdAt: -1,
        });

      res.status(200).json({
        success: true,
        employee,
        documents,
        history,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ================= UPDATE EMPLOYEE =================
exports.updateEmployee = async (req, res) => {
  try {
    const employeeId = req.params.id;
    const actionType =
      req.body.action?.trim();

    const updateData = {
      ...req.body,
    };

    // action update only if passed
    if (actionType) {
      updateData.currentAction =
        actionType;
    }

    delete updateData.action;

    const employee =
      await Employee.findByIdAndUpdate(
        employeeId,
        updateData,
        { new: true }
      );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const files = req.files || {};

    let employeeDocument =
      await EmployeeDocument.findOne({
        employeeID: employeeId,
      });

    if (employeeDocument) {
      employeeDocument.aadharCard =
        files?.aadharCard?.[0]?.filename ||
        employeeDocument.aadharCard;

      employeeDocument.panCard =
        files?.panCard?.[0]?.filename ||
        employeeDocument.panCard;

      employeeDocument.resume =
        files?.resume?.[0]?.filename ||
        employeeDocument.resume;

      employeeDocument.offerLetter =
        files?.offerLetter?.[0]?.filename ||
        employeeDocument.offerLetter;

      employeeDocument.joiningLetter =
        files?.joiningLetter?.[0]?.filename ||
        employeeDocument.joiningLetter;

      if (files?.certificates?.length) {
        employeeDocument.certificates =
          files.certificates.map(
            (file) => file.filename
          );
      }

      await employeeDocument.save();
    }

    let history = null;

    if (actionType) {
      history =
        await EmployeeHistory.create({
          employeeID: employeeId,
          action: actionType,
          message:
            `Employee moved to ${actionType}`,
        });
    }

    res.status(200).json({
      success: true,
      message:
        "Employee updated successfully",
      employee,
      documents: employeeDocument,
      history,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= REMOVE EMPLOYEE =================
exports.removeEmployee =
  async (req, res) => {
    try {
      const employeeId =
        req.params.id;

      const employee =
        await Employee.findById(
          employeeId
        );

      if (
        !employee
      ) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Employee not found",
          });
      }

      // DELETE DOCUMENTS
      await EmployeeDocument.deleteOne(
        {
          employeeID:
            employeeId,
        }
      );

      // HISTORY
     await EmployeeHistory.create({
  employeeID: employeeId,
  action: "exit",
  message: `${employee.firstName} ${employee.lastName} removed from company`,
});

      // DELETE EMPLOYEE
      await Employee.findByIdAndDelete(
        employeeId
      );

      res.status(200).json({
        success: true,
        message:
          "Employee removed successfully",
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };