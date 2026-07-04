const Project = require("../models/projectModel");
const Task = require("../models/taskModel");
const Milestone = require("../models/milestoneModel");
const DailyUpdate = require("../models/dailyUpdateModel");


// ====================================================== 
// PROJECT CONTROLLER
// ======================================================

// Create Project
exports.createProject = async (req, res) => {
  try {
    const project = await Project.create(req.body);

    const populatedProject = await Project.findById(project._id)
      .populate("teamLead", "name email")
      .populate("employees", "name email")
      .populate("interns", "name email");

    res.status(201).json({
      success: true,
      data: populatedProject
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get All Projects
exports.getAllProjects =
  async (req, res) => {
    try {
     const projects = await Project.find()
  .populate("teamLead", "name email")
  .populate("employees", "name email")
  .populate("interns", "name email");

console.log(JSON.stringify(projects, null, 2));
      res.status(200).json({
        success: true,
        data: projects,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// Get Single Project
exports.getSingleProject =
  async (req, res) => {
    try {
      const project =
        await Project.findById(
          req.params.id
        )
          .populate(
            "teamLead",
            "name email"
          )
          .populate(
            "employees",
            "name email"
          )
          .populate(
            "interns",
            "name email"
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
        message:
          error.message,
      });
    }
  };

// Assign Team Lead
exports.assignTeamLead = async (req, res) => {
  try {
    const { teamLeadId } = req.body;

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { teamLead: teamLeadId },
      { new: true }
    )
      .populate("teamLead", "name email")
      .populate("employees", "name email")
      .populate("interns", "name email");

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

// Assign Employees
exports.assignEmployees = async (req, res) => {
  try {
    const { employeeIds } = req.body;

    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "employeeIds must be a non-empty array",
      });
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: {
          employees: {
            $each: employeeIds,
          },
        },
      },
      { new: true }
    ).populate("employees", "name email");

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

// Assign Interns
exports.assignInterns =
  async (req, res) => {
    try {
      const {
        internIds,
      } = req.body;

      const project =
        await Project.findByIdAndUpdate(
          req.params.id,
          {
            $addToSet: {
              interns: {
                $each:
                  internIds,
              },
            },
          },
          { new: true }
        ).populate("interns", "name email");

      res.status(200).json({
        success: true,
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

// Update Project Status
exports.updateProjectStatus =
  async (req, res) => {
    try {
      const project =
        await Project.findByIdAndUpdate(
          req.params.id,
          {
            status:
              req.body.status,
          },
          { new: true }
        );

      res.status(200).json({
        success: true,
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

// Delete Project
exports.deleteProject =
  async (req, res) => {
    try {
      await Project.findByIdAndDelete(
        req.params.id
      );

      res.status(200).json({
        success: true,
        message:
          "Project deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ======================================================
// MILESTONE CONTROLLER
// ======================================================

// Create Milestone
exports.createMilestone =
  async (req, res) => {
    try {
      const milestone =
        await Milestone.create(
          req.body
        );

      res.status(201).json({
        success: true,
        data:
          milestone,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

  exports.getAllMilestones = async (req, res) => {
  try {
    const milestones = await Milestone.find()
      .populate("projectId", "projectName clientName");

    res.status(200).json({
      success: true,
      count: milestones.length,
      data: milestones,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Project Milestones
exports.getProjectMilestones =
  async (req, res) => {
    try {
      const milestones =
        await Milestone.find(
          {
            projectId:
              req.params.projectId,
          }
        );

      res.status(200).json({
        success: true,
        data:
          milestones,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// Complete Milestone
exports.completeMilestone =
  async (req, res) => {
    try {
      const milestone =
        await Milestone.findByIdAndUpdate(
          req.params.id,
          {
            status:
              "completed",
          },
          { new: true }
        );

      res.status(200).json({
        success: true,
        data:
          milestone,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ======================================================
// TASK CONTROLLER
// ======================================================

// Create Task
exports.createTask =
  async (req, res) => {
    try {
      const task =
        await Task.create(
          req.body
        );

      res.status(201).json({
        success: true,
        data: task,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// Get Tasks By Project
exports.getProjectTasks =
  async (req, res) => {
    try {
      const tasks =
        await Task.find({
          projectId:
            req.params.projectId,
        })
          .populate(
            "assignedTo",
            "name email"
          );

      res.status(200).json({
        success: true,
        data: tasks,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// Update Task Progress
exports.updateTaskProgress =
  async (req, res) => {
    try {
      const task =
        await Task.findByIdAndUpdate(
          req.params.id,
          {
            progress:
              req.body.progress,
          },
          { new: true }
        );

      res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// Update Task Status
exports.updateTaskStatus =
  async (req, res) => {
    try {
      const task =
        await Task.findByIdAndUpdate(
          req.params.id,
          {
            status:
              req.body.status,
          },
          { new: true }
        );

      res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ======================================================
// DAILY UPDATE CONTROLLER
// ======================================================

// Add Daily Update
exports.addDailyUpdate =
  async (req, res) => {
    try {
      const update =
        await DailyUpdate.create(
          req.body
        );

      await Task.findByIdAndUpdate(
        req.body.taskId,
        {
          progress:
            req.body.progress,
        }
      );

      res.status(201).json({
        success: true,
        data: update,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// Get Task Updates
exports.getTaskUpdates =
  async (req, res) => {
    try {
      const updates =
        await DailyUpdate.find(
          {
            taskId:
              req.params.taskId,
          }
        ).populate(
          "userId",
          "name email"
        );

      res.status(200).json({
        success: true,
        data:
          updates,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };