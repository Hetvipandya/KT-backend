const express =
  require("express");

const router =
  express.Router();

const {
  // Project
  createProject,
  getAllProjects,
  getSingleProject,
  assignTeamLead,
  assignEmployees,
  assignInterns,
  updateProjectStatus,
  deleteProject,

  // Milestone
  createMilestone,
  getProjectMilestones,
  completeMilestone,

  // Task
  createTask,
  getProjectTasks,
  updateTaskProgress,
  updateTaskStatus,

  // Daily Update
  addDailyUpdate,
  getTaskUpdates,
} = require( 
  "../controllers/projectController"
);


// ======================================================
// PROJECT ROUTES
// ======================================================

// Create Project
router.post(
  "/project/create",
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

// Get Project Milestones
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

// Get Project Tasks
router.get(
  "/task/:projectId",
  getProjectTasks
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

module.exports =
  router;