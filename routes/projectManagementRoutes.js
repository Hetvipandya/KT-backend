const express =
  require("express");

const router =
  express.Router();

const {
  createProject,
  getProjects,
  getProjectDetails,
  updateProject,
  deleteProject,
  updateProjectStatus,

  createMilestone,
  getMilestones,

  uploadDocument,
  getDocuments,

  getStatusLogs,
} = require(
  "../controllers/projectManagementController"
);


// =====================
// PROJECT ROUTES
// =====================

// CREATE PROJECT
router.post(
  "/management/create",
  createProject
);

// GET PROJECT LIST
router.get(
  "/list",
  getProjects
);

// GET PROJECT DETAILS
router.get(
  "/details/:id",
  getProjectDetails
);

// UPDATE PROJECT
router.put(
  "/update/:id",
  updateProject
);

// DELETE PROJECT
router.delete(
  "/delete/:id",
  deleteProject
);

// UPDATE STATUS
router.put(
  "/status/:id",
  updateProjectStatus
);



// =====================
// MILESTONE ROUTES
// =====================

// CREATE MILESTONE
router.post(
  "/milestone/create",
  createMilestone
);  

// GET MILESTONES
router.get(
  "/milestone/list/:projectId",
  getMilestones
);



// =====================
// DOCUMENT ROUTES
// =====================

// UPLOAD DOCUMENT
router.post(
  "/document/upload",
  uploadDocument
);

// GET DOCUMENTS
router.get(
  "/document/list/:projectId",
  getDocuments
);



// =====================
// STATUS LOG ROUTES
// =====================

// GET STATUS LOGS
router.get(
  "/status/logs/:projectId",
  getStatusLogs
);

module.exports =
  router;