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

 

router.get("/employee/:employeeId", getTasksByEmployeeId);

// Create Task
router.post("/create", upload.array("attachments"), createTask);

// Get All Tasks
router.get("/all", getAllTasks);

// Update Task
router.put("/update/:id", updateTask);

// Task Status Routes
router.put("/status/:id", updateTaskStatus);
router.post("/status/create", createStatus);
router.get("/status/:taskId", getStatus);
router.delete("/status/delete/:taskId", deleteStatus);

// Add Comment
router.post("/comment/:id", addComment);

// Delete Task
router.delete("/delete/:id", deleteTask);

// Get Single Task (placed last to prevent capturing other routes)
router.get("/:id", getTaskById);

module.exports = router;