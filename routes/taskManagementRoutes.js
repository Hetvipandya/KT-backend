const express =
  require("express");

const router =
  express.Router();

const {
  getTasksByEmployeeId,
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  createStatus,
  getStatus,
  deleteStatus,
  updateTaskStatus, 
  addComment,
  deleteTask, 
} = require(
  "../controllers/taskManagementController"
);
const upload = require("../middleware/uploadMiddleware");

 

router.get(
  "/employee/:employeeId",getTasksByEmployeeId
);

// Create Task
router.post(
  "/create",
    upload.array("attachments"), 
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
router.put(
  "/status/:id",
  updateTaskStatus
);
router.post("/create", createStatus);
router.get("/:taskId", getStatus);
router.delete("/delete/:taskId", deleteStatus);

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