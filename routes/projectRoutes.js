const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware"); // <-- Cloudinary Multer Middleware

const {
  // Project
  createProject, 
  getAllProjects,
  getSingleProject, 
  getProjectMembers, 
  assignTeamLead, 
  assignEmployees,
  assignInterns,
  updateProjectStatus,
  deleteProject,

  // Milestone
  createMilestone,
  getProjectMilestones,
  completeMilestone,
  getAllMilestones,

  // Task
  createTask,
  getAllTasks,
  getProjectTasks,
  getMilestoneTasks,
  getTasksByAssignedEmployee,
  getSingleTask,
  updateTaskProgress,
  updateTaskStatus,
  updateTask,
  deleteTask,

  // Daily Update
  addDailyUpdate,
  getTaskUpdates,
} = require("../controllers/projectController"); 


// ======================================================
// PROJECT ROUTES
// ======================================================

// Create Project with Cloudinary File Upload 
router.post(
  "/project/create",
  upload.array("files", 10), // field name = files
  createProject
);

// Get All Projects
router.get(
  "/project/all",
  getAllProjects
);

// Get Single Project
router.get(
  "/project/:id",
  getSingleProject
);

// Get Automatically Fetched Project Members (Team Lead + Employees + Interns)
router.get(
  "/project/members/:projectId",
  getProjectMembers
);

// Assign Team Lead
router.put(
  "/project/teamlead/:id",
  assignTeamLead
);

// Assign Employees
router.put(
  "/project/employees/:id",
  assignEmployees
);

// Assign Interns
router.put(
  "/project/interns/:id",
  assignInterns
);

// Update Project Status
router.put(
  "/project/status/:id",
  updateProjectStatus
);

// Delete Project
router.delete(
  "/project/delete/:id",
  deleteProject
);


// ======================================================
// MILESTONE ROUTES
// ======================================================

// Create Milestone
router.post(
  "/milestone/create",
  createMilestone
);
router.post(
  "/milestones/create",
  createMilestone
);

// Get All Milestones
router.get(
  "/milestones/all",
  getAllMilestones
);

// Get Project Milestones
router.get(
  "/milestone/project/:projectId",
  getProjectMilestones
);
router.get(
  "/milestones/project/:projectId",
  getProjectMilestones
);
router.get(
  "/milestones/all/project/:projectId",
  getProjectMilestones
);
router.get(
  "/milestone/:projectId",
  getProjectMilestones
);

// Complete Milestone
router.put(
  "/milestone/complete/:id",
  completeMilestone
);


// ======================================================
// TASK ROUTES
// ======================================================

// Create Task
router.post(
  "/task/create",
  createTask
);

// Get All Tasks
router.get(
  "/task/all",
  getAllTasks
);
router.get(
  "/tasks/all",
  getAllTasks
);

// Get Project Tasks
router.get(
  "/task/project/:projectId",
  getProjectTasks
);

// Get Milestone Tasks
router.get(
  "/task/milestone/:milestoneId",
  getMilestoneTasks
);

// Get Employee Tasks
router.get(
  "/task/employee/:userId",
  getTasksByAssignedEmployee
);

// Get Single Task
router.get(
  "/task/single/:id",
  getSingleTask
);

// Get Project Tasks fallback (must be placed after fixed prefixes)
router.get(
  "/task/:projectId",
  getProjectTasks
);

// Update Task (General update)
router.put(
  "/task/update/:id",
  updateTask
);

// Update Task Progress
router.put(
  "/task/progress/:id",
  updateTaskProgress
);

// Update Task Status
router.put(
  "/task/status/:id",
  updateTaskStatus
);

// Delete Task
router.delete(
  "/task/delete/:id",
  deleteTask
);
router.delete(
  "/task/:id",
  deleteTask
);


// ======================================================
// DAILY UPDATE ROUTES
// ======================================================

// Add Daily Update
router.post(
  "/daily-update/add",
  addDailyUpdate
);

// Get Task Updates
router.get(
  "/daily-update/:taskId",
  getTaskUpdates
);

module.exports = router;