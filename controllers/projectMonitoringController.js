const Project =
  require("../models/Project");

const Task =
  require("../models/taskModel");

const ProjectAnalytics =
  require(
    "../models/ProjectAnalytics"
  );

  exports.createAnalytics =
  async (req, res) => {
    try {
      const analytics =
        await ProjectAnalytics.create(
          req.body
        );

      res.status(201).json({
        success: true,
        message:
          "Project analytics added successfully",
        data: analytics,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };
  
// ============================
// GET DASHBOARD 
// ============================
exports.getDashboard =
  async (req, res) => {
    try {
      const totalProjects =
        await Project.countDocuments();

      const activeProjects =
        await Project.countDocuments(
          {
            status: "Active",
          }
        );

      const completedProjects =
        await Project.countDocuments(
          {
            status: "Completed",
          }
        );

      const delayedProjects =
        await Project.countDocuments(
          {
            status: "Delayed",
          }
        );

      const pendingReviews =
        await Project.countDocuments(
          {
            reviewStatus:
              "Pending",
          }
        );

      res.status(200).json({
        success: true,
        dashboard: {
          totalProjects,
          activeProjects,
          completedProjects,
          delayedProjects,
          pendingReviews,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ============================
// GET PROJECT ANALYTICS
// ============================
exports.getAnalytics =
  async (req, res) => {
    try {
      const analytics =
        await ProjectAnalytics.find()
          .populate(
            "projectId",
            "projectName status"
          );

      res.status(200).json({
        success: true,
        count:
          analytics.length,
        data: analytics,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };