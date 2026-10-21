const Project = require("../models/projectModel");
const Task = require("../models/taskModel");
const Milestone = require("../models/milestoneModel");

const recalculateMilestoneAndProjectProgress = async (milestoneId, targetProjectId = null) => {
  let projectId = targetProjectId;

  if (milestoneId) {
    const milestone = await Milestone.findById(milestoneId);
    if (milestone && milestone.projectId) {
      projectId = milestone.projectId;
    }

    const tasks = await Task.find({ milestoneId }); 
    const milestoneProgress =
      tasks.length === 0
        ? 0
        : Math.round(tasks.reduce((sum, task) => sum + (task.progress || 0), 0) / tasks.length);

    let milestoneStatus = "pending";
    if (milestoneProgress > 0 && milestoneProgress < 100) {
      milestoneStatus = "in_progress";
    } else if (milestoneProgress === 100) {
      milestoneStatus = "completed";
    }

    await Milestone.findByIdAndUpdate(
      milestoneId,
      {
        progress: milestoneProgress,
        status: milestoneStatus,
        completedAt: milestoneProgress === 100 ? new Date() : null,
      },
      { new: true }
    );
  }

  if (projectId) {
    const milestones = await Milestone.find({ projectId });
    let projectProgress = 0;

    if (milestones.length > 0) {
      projectProgress = Math.round(
        milestones.reduce((sum, milestone) => sum + (milestone.progress || 0), 0) / milestones.length
      );
    } else {
      const projectTasks = await Task.find({ projectId });
      if (projectTasks.length > 0) {
        projectProgress = Math.round(
          projectTasks.reduce((sum, task) => sum + (task.progress || 0), 0) / projectTasks.length
        );
      }
    }

    let projectStatus = "pending";
    if (projectProgress > 0 && projectProgress < 100) {
      projectStatus = "in_progress";
    } else if (projectProgress === 100) {
      projectStatus = "completed";
    }

    await Project.findByIdAndUpdate(projectId, {
      progress: projectProgress,
      status: projectStatus,
    });
  }
};

module.exports = recalculateMilestoneAndProjectProgress;
