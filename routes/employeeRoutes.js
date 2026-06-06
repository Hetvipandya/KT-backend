const express =
  require("express");

const router =
  express.Router();

const multer =
  require("multer");

const path =
  require("path");

const {
  addEmployee,
  getEmployeeList,
  getEmployeeProfile,
  updateEmployee,
  removeEmployee,
} = require(
  "../controllers/employeeController"
);

// ================= MULTER STORAGE =================
const storage =
  multer.diskStorage({
    destination:
      function (
        req,
        file,
        cb
      ) {
        cb(
          null,
          "uploads/employees"
        );
      },

    filename:
      function (
        req,
        file,
        cb
      ) {
        cb(
          null,
          Date.now() +
            "-" +
            file.originalname
        );
      },
  });

const upload =
  multer({
    storage,
  });

// ================= FILE FIELDS =================
const employeeDocuments =
  upload.fields([
    {
      name:
        "aadharCard",
      maxCount: 1,
    },
    {
      name: "panCard",
      maxCount: 1,
    },
    {
      name: "resume",
      maxCount: 1,
    },
    {
      name:
        "offerLetter",
      maxCount: 1,
    },
    {
      name:
        "joiningLetter",
      maxCount: 1,
    },
    {
      name:
        "certificates",
      maxCount: 10,
    },
  ]);

// ================= ADD EMPLOYEE =================
router.post(
  "/add",
  employeeDocuments,
  addEmployee
);

// ================= EMPLOYEE LIST =================
router.get(
  "/list",
  getEmployeeList
);

// ================= EMPLOYEE PROFILE =================
router.get(
  "/profile/:id",
  getEmployeeProfile
);

// ================= UPDATE EMPLOYEE =================
router.put(
  "/update/:id",
  employeeDocuments,
  updateEmployee
);

// ================= REMOVE EMPLOYEE =================
router.delete(
  "/remove/:id",
  removeEmployee
);

module.exports =
  router;