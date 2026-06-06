const express =
  require("express");

const router =
  express.Router();

const {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require(
  "../controllers/taskManagementController"
);

// Create Task
router.post(
  "/create",
  createTask
);

// Get All Tasks
router.get(
  "/all",
  getAllTasks
);

// Get Single Task
router.get(
  "/:id",
  getTaskById
);

// Update Task
router.put(
  "/update/:id",
  updateTask
);

// Update Status
router.patch(
  "/status/:id",
  updateTaskStatus
);

// Delete Task
router.delete(
  "/delete/:id",
  deleteTask
);

module.exports =
  router;