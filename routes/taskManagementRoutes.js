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
  addComment,
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

// Update Task Status
router.patch(
  "/status/:id",
  updateTaskStatus
);

// Add Comment
router.post(
  "/comment/:id",
  addComment
);

// Delete Task
router.delete(
  "/delete/:id",
  deleteTask
);

module.exports =
  router;