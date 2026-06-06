const express =
  require("express");

const router =
  express.Router();

const {
  createDepartment,
  getDepartmentList,
  updateDepartment,
} = require(
  "../controllers/departmentController"
); 

// CREATE
router.post(
  "/create",
  createDepartment
);

// LIST
router.get(
  "/list",
  getDepartmentList
);

// UPDATE
router.put(
  "/update",
  updateDepartment
);

module.exports =
  router;