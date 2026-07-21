const Project =
  require("../models/Project");

const ProjectMilestone =
  require(
    "../models/ProjectMilestone"
  );

const ProjectStatusLog =
  require(
    "../models/ProjectStatusLog"
  );

const ProjectDocument =
  require(
    "../models/ProjectDocument"
  );

const getProjectProgressForStatus = (status) => {
  switch (status) {
    case "Planning":
      return 10;
    case "In Progress":
      return 40;
    case "On Hold":
      return 50;
    case "Review":
      return 75;
    case "Completed":
      return 100;
    default:
      return null;
  }
};

// ======================
// PROJECT CONTROLLERS
// ======================

// CREATE PROJECT
exports.createProject =
  async (req, res) => {
    try {

      // Find Last Project
      const lastProject =
        await Project.findOne()
          .sort({
            createdAt: -1,
          });

      let projectCode =
        "PR1";

      // Generate Next Code
      if (
        lastProject &&
        lastProject.projectCode
      ) {
        const lastNumber =
          parseInt(
            lastProject.projectCode.replace(
              "PR",
              ""
            )
          ) || 0;

        projectCode =
          `PR${lastNumber + 1}`;
      }

      // Create Project
      const project =
        await Project.create({
          ...req.body,
          projectCode,
        });

      res.status(201).json({
        success: true,
        message:
          "Project created successfully",
        data: project,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// GET ALL PROJECTS
exports.getProjects =
  async (req, res) => {
    try {
      const projects = 
        await Project.find({
          isDeleted: false,
        })
          .populate(
            "projectManager"
          )
          .populate(
            "teamLead"
          )
          .populate(
            "teamMembers"
          );

      res.status(200).json({
        success: true,
        data: projects,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// GET PROJECT DETAILS
exports.getProjectDetails =
  async (req, res) => {
    try {
      const project =
        await Project.findById(
          req.params.id
        )
          .populate(
            "projectManager"
          )
          .populate(
            "teamLead"
          )
          .populate(
            "teamMembers"
          );

      if (!project) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Project not found",
          });
      }

      res.status(200).json({
        success: true,
        data: project,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// UPDATE PROJECT
exports.updateProject =
  async (req, res) => {
    try {
      const project =
        await Project.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true }
        );

      res.status(200).json({
        success: true,
        message:
          "Project updated successfully",
        data: project,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// DELETE PROJECT
exports.deleteProject =
  async (req, res) => {
    try {
      await Project.findByIdAndUpdate(
        req.params.id,
        {
          isDeleted: true,
        }
      );

      res.status(200).json({
        success: true,
        message:
          "Project deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// UPDATE PROJECT STATUS
exports.updateProjectStatus =
  async (req, res) => {
    try {
      const {
        status,
        remarks,
        updatedBy,
      } = req.body;

      const project =
        await Project.findById(
          req.params.id
        );

      if (!project) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Project not found",
          });
      }

      const oldStatus =
        project.status;

      project.status =
        status;

      const autoProgress = getProjectProgressForStatus(status);
      if (autoProgress !== null) {
        project.progress = autoProgress;
      }

      await project.save();

      await ProjectStatusLog.create(
        {
          projectId:
            project._id,
          oldStatus,
          newStatus:
            status,
          remarks,
          updatedBy,
        }
      );

      res.status(200).json({
        success: true,
        message:
          "Project status updated successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };



// ======================
// MILESTONE CONTROLLERS
// ======================

// CREATE MILESTONE
exports.createMilestone =
  async (req, res) => {
    try {
      const milestone =
        await ProjectMilestone.create(
          req.body
        );

      res.status(201).json({
        success: true,
        message:
          "Milestone created successfully",
        data: milestone,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// GET MILESTONES
exports.getMilestones =
  async (req, res) => {
    try {
      const milestones =
        await ProjectMilestone.find({
          projectId:
            req.params.projectId,
        });

      res.status(200).json({
        success: true,
        data: milestones,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };



// ======================
// DOCUMENT CONTROLLERS
// ======================

// CREATE DOCUMENT
exports.uploadDocument =
  async (req, res) => {
    try {
      const document =
        await ProjectDocument.create(
          req.body
        );

      res.status(201).json({
        success: true,
        message:
          "Document uploaded successfully",
        data: document,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// GET DOCUMENTS
exports.getDocuments =
  async (req, res) => {
    try {
      const documents =
        await ProjectDocument.find({
          projectId:
            req.params.projectId,
        });

      res.status(200).json({
        success: true,
        data: documents,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };



// ======================
// STATUS LOG CONTROLLERS
// ======================

// GET STATUS LOGS
exports.getStatusLogs =
  async (req, res) => {
    try {
      const logs =
        await ProjectStatusLog.find({
          projectId:
            req.params.projectId,
        }).populate(
          "updatedBy"
        );

      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };