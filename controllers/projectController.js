const Project = require("../models/projectModel");
const Task = require("../models/taskModel");
const Milestone = require("../models/milestoneModel");
const DailyUpdate = require("../models/dailyUpdateModel");
const User = require("../models/User");
const Employee = require("../models/Employee");

// ======================================================
// BUILD TASK HELPER FUNCTIONS
// ======================================================
const resolveProjectTeamLeadUser = async (project) => {
  if (!project) {
    return null;
  }

  // If project already has User ID
  if (project.teamLeadUser) {
    return project.teamLeadUser;
  }

  // If project has Employee ID
  if (project.teamLeadEmployee) {
    const employee = await Employee.findById(
      project.teamLeadEmployee
    ).select("userID");

    if (employee?.userID) {
      return employee.userID;
    }
  }

  // If project stores Team ID
  if (project.teamLead) {
    const team = await Team.findById(project.teamLead)
      .select("teamLeadUser");

    if (team?.teamLeadUser) {
      return team.teamLeadUser;
    }
  }

  return null;
};

const buildProjectAssignmentTasks = ({
  projectId,
  projectName,
  employees = [],
  interns = [],
  assignedBy = null,
  assignedTeamLead = null,
  employeeUserMap = {},
  internUserMap = {},
}) => {
  if (!projectId) {
    return [];
  }

  const tasks = [];
  const seen = new Set();

  const addTask = ({ userId, role, label }) => {
    if (!userId) {
      return;
    }

    const uniqueKey = `${String(projectId)}:${String(userId)}:${role}:${label}`;
    if (seen.has(uniqueKey)) {
      return;
    }

    seen.add(uniqueKey);
    
    const taskData = {
      projectId,
      milestoneId: null,
      taskTitle: `${projectName || "Project"} - ${label}`,
      taskDescription: `Project assignment for ${projectName || "Project"}.`,
      assignedBy: assignedBy || assignedTeamLead || userId,
      assignedTeamLead: assignedTeamLead || null,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedHours: 0,
      priority: "medium",
      status: "pending",
      progress: 0,
      taskDependencies: [],
      subTasks: [],
      checklist: [],
      comments: [],
      attachments: [],
    };

    if (role === "employee") {
      taskData.assignedEmployee = userId;
      taskData.assignedIntern = null;
    } else if (role === "intern") {
      taskData.assignedIntern = userId;
      taskData.assignedEmployee = null;
    }

    tasks.push(taskData);
  };

  employees.forEach((employeeId, index) => {
    // For employees, we store Employee ID in project, but need to get User ID
    const userId = employeeUserMap[String(employeeId)] || employeeUserMap[employeeId];
    if (!userId) {
      return;
    }
    const employeeLabel = `Employee ${index + 1}`;
    addTask({ userId, role: "employee", label: employeeLabel });
  });

  interns.forEach((internId, index) => {
    // For interns, the ID stored in project is the User ID directly
    const userId = internUserMap[String(internId)] || internUserMap[internId] || internId;
    const internLabel = `Intern ${index + 1}`;
    addTask({ userId, role: "intern", label: internLabel });
  });

  return tasks;
};

const autoCreateProjectTasks = async ({ project, assignedBy }) => {
  if (!project) {
    return [];
  }

  const employees = Array.isArray(project.employees) ? project.employees : [];
  const interns = Array.isArray(project.interns) ? project.interns : [];
  const assignedTeamLead = await resolveProjectTeamLeadUser(project);

  if (employees.length === 0 && interns.length === 0) {
    return [];
  }

  // For employees: Employee IDs are stored, need to get User IDs
  const employeeUserMap = {};
  if (employees.length > 0) {
    const employeeRecords = await Employee.find({ _id: { $in: employees } })
      .select("_id userID firstName lastName")
      .populate("userID", "name email");
    
    employeeRecords.forEach((employee) => {
      if (employee.userID) {
        // If userID is populated, get the _id, else use the userID directly
        const userId = employee.userID._id || employee.userID;
        employeeUserMap[String(employee._id)] = userId;
      }
    });
  }

  // For interns: User IDs are stored directly
  const internUserMap = {};
  interns.forEach((internId) => {
    if (internId) {
      internUserMap[String(internId)] = internId;
    }
  });

  const tasks = buildProjectAssignmentTasks({
    projectId: project._id,
    projectName: project.projectName,
    employees,
    interns,
    assignedBy: assignedBy || assignedTeamLead || null,
    assignedTeamLead,
    employeeUserMap,
    internUserMap,
  });

  if (!tasks.length) {
    return [];
  }

  const createdTasks = [];
  for (const task of tasks) {
    const existingTask = await Task.findOne({
      projectId: task.projectId,
      $or: [
        { assignedEmployee: task.assignedEmployee },
        { assignedIntern: task.assignedIntern }
      ],
      taskTitle: task.taskTitle,
    });

    if (existingTask) {
      createdTasks.push(existingTask);
      continue;
    }

    const createdTask = await Task.create(task);
    createdTasks.push(createdTask);
  }

  return createdTasks;
};

module.exports.buildProjectAssignmentTasks = buildProjectAssignmentTasks;
module.exports.autoCreateProjectTasks = autoCreateProjectTasks;

// ======================================================
// PROJECT CONTROLLER
// ======================================================

// Create Project
exports.createProject = async (req, res) => {
  try {
    const uploadedFiles = req.files
      ? req.files.map((file) => ({
          fileName: file.originalname,
          fileUrl: file.path,
        }))
      : [];

    const project = await Project.create({
      ...req.body,
      files: uploadedFiles,
    });

    const populatedProject = await Project.findById(project._id)
      .populate("teamLeadUser", "name email")
      .populate("teamLeadEmployee", "firstName lastName email")
      .populate("employees", "firstName lastName email")
      .populate("interns", "name email");

    await autoCreateProjectTasks({
      project: populatedProject || project,
      assignedBy: req.user?._id || req.body.assignedBy || project.teamLeadUser || null,
    });

    res.status(201).json({
      success: true,
      data: populatedProject || project,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Projects
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("teamLeadUser", "name email employeeID")
      .populate("teamLeadEmployee", "name email employeeID")
      .populate("employees", "name email employeeID")
      .populate("interns", "name email");

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

// Get Single Project
exports.getSingleProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("teamLeadUser", "name email")
      .populate("teamLeadEmployee", "firstName lastName email")
      .populate("employees", "firstName lastName email")
      .populate("interns", "name email");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
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

// Assign Team Lead
exports.assignTeamLead = async (req, res) => {
  try {
    const { teamLeadId } = req.body;

    let resolvedTeamLeadUser = null;
    let resolvedTeamLeadEmployee = null;

    if (teamLeadId) {
      const user = await User.findById(teamLeadId);
      if (user) {
        if (user.role === "admin") {
          return res.status(400).json({
            success: false,
            message: "Admin cannot be assigned as Team Lead",
          });
        }
        if (user.role !== "teamlead" && user.role !== "team lead") {
          user.role = "team lead";
          await user.save();
        }
        resolvedTeamLeadUser = user._id;

        const linkedEmp = await Employee.findOne({ userID: user._id });
        if (linkedEmp) {
          resolvedTeamLeadEmployee = linkedEmp._id;
          if (!linkedEmp.isTeamLead) {
            linkedEmp.isTeamLead = true;
            await linkedEmp.save();
          }
        }
      }

      const emp = await Employee.findById(teamLeadId);
      if (emp) {
        resolvedTeamLeadEmployee = emp._id;
        if (emp.userID) {
          resolvedTeamLeadUser = emp.userID;
        }
        if (!emp.isTeamLead) {
          emp.isTeamLead = true;
          await emp.save();
        }
        if (emp.userID) {
          const linkedUser = await User.findById(emp.userID);
          if (linkedUser) {
            if (linkedUser.role === "admin") {
              return res.status(400).json({
                success: false,
                message: "Admin cannot be assigned as Team Lead",
              });
            }
            if (linkedUser.role !== "teamlead" && linkedUser.role !== "team lead") {
              linkedUser.role = "team lead";
              await linkedUser.save();
            }
          }
        }
      }
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      {
        teamLeadUser: resolvedTeamLeadUser || null,
        teamLeadEmployee: resolvedTeamLeadEmployee || null,
      },
      { new: true }
    )
      .populate("teamLeadUser", "name email role")
      .populate("teamLeadEmployee", "firstName lastName email employeeID")
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

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
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
    ).populate("employees", "firstName lastName email");

    // Get fresh project data with populated interns for task creation
    const freshProject = await Project.findById(req.params.id)
      .populate("employees", "firstName lastName email")
      .populate("interns", "name email");

    await autoCreateProjectTasks({
      project: freshProject || project,
      assignedBy: req.user?._id || req.body.assignedBy || null,
    });

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
exports.assignInterns = async (req, res) => {
  try {
    const { internIds } = req.body;

    if (!internIds || !Array.isArray(internIds) || internIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "internIds must be a non-empty array",
      });
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: {
          interns: {
            $each: internIds,
          },
        },
      },
      { new: true }
    ).populate("interns", "name email");

    // Get fresh project data with populated employees for task creation
    const freshProject = await Project.findById(req.params.id)
      .populate("employees", "firstName lastName email")
      .populate("interns", "name email");

    await autoCreateProjectTasks({
      project: freshProject || project,
      assignedBy: req.user?._id || req.body.assignedBy || null,
    });

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

// Update Project Status
exports.updateProjectStatus = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
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
      message: error.message,
    });
  }
};

// Delete Project
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const milestones = await Milestone.find({ projectId: id }).select("_id");
    const milestoneIds = milestones.map((milestone) => milestone._id);

    const tasks = await Task.find({
      $or: [{ projectId: id }, { milestoneId: { $in: milestoneIds } }],
    }).select("_id");

    const taskIds = tasks.map((task) => task._id);

    if (taskIds.length > 0) {
      await DailyUpdate.deleteMany({
        taskId: { $in: taskIds },
      });
    }

    await Task.deleteMany({
      $or: [{ projectId: id }, { milestoneId: { $in: milestoneIds } }],
    });

    await Milestone.deleteMany({
      projectId: id,
    });

    await Project.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Project and all related data deleted successfully",
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// TASK CONTROLLER
// ======================================================

// Create Task
exports.createTask = async (req, res) => {
  try {
    const taskData = { ...req.body };

    // ================= Auto Assign From Project =================
    if (taskData.projectId) {
      const project = await Project.findById(taskData.projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      // Employee
      if (!taskData.assignedEmployee && project.employees && project.employees.length > 0) {
        taskData.assignedEmployee = project.employees[0];
      }

      // Intern
      if (!taskData.assignedIntern && project.interns && project.interns.length > 0) {
        taskData.assignedIntern = project.interns[0];
      }

      // ================= TEAM LEAD =================
    // ================= TEAM LEAD =================
if (!taskData.assignedTeamLeadUser) {
  if (project.teamLeadUser) {
    taskData.assignedTeamLeadUser = project.teamLeadUser;
  }
}

if (!taskData.assignedTeamLeadEmployee) {
  if (project.teamLeadEmployee) {
    taskData.assignedTeamLeadEmployee = project.teamLeadEmployee;
  }
}

// Assigned By
if (!taskData.assignedBy) {
  taskData.assignedBy =
    req.user?._id ||
    taskData.assignedTeamLeadUser ||
    null;
}
    }

    // ================= Create Task =================
    const task = await Task.create(taskData);

    // ================= Populate =================
 const populatedTask = await Task.findById(task._id)
  .populate(
    "assignedEmployee",
    "firstName lastName email"
  )
  .populate(
    "assignedIntern",
    "name email"
  )
  .populate(
    "assignedTeamLeadUser",
    "name email"
  )
  .populate(
    "assignedTeamLeadEmployee",
    "firstName lastName email"
  )
  .populate(
    "assignedBy",
    "name email"
  );

    // ================= Update Milestone =================
    if (task.milestoneId) {
      const tasks = await Task.find({
        milestoneId: task.milestoneId,
      });

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === "completed").length;
      const milestoneProgress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

      let milestoneStatus = "pending";
      if (milestoneProgress > 0 && milestoneProgress < 100) {
        milestoneStatus = "in_progress";
      } else if (milestoneProgress === 100) {
        milestoneStatus = "completed";
      }

      const milestone = await Milestone.findByIdAndUpdate(
        task.milestoneId,
        {
          progress: milestoneProgress,
          status: milestoneStatus,
          completedAt: milestoneProgress === 100 ? new Date() : null,
        },
        { new: true }
      );

      // ================= Update Project =================
      if (milestone) {
        const milestones = await Milestone.find({
          projectId: milestone.projectId,
        });

        const totalMilestones = milestones.length;
        const completedMilestones = milestones.filter((m) => m.status === "completed").length;
        const projectProgress = totalMilestones === 0 ? 0 : Math.round((completedMilestones / totalMilestones) * 100);

        let projectStatus = "pending";
        if (projectProgress > 0 && projectProgress < 100) {
          projectStatus = "in_progress";
        } else if (projectProgress === 100) {
          projectStatus = "completed";
        }

        await Project.findByIdAndUpdate(
          milestone.projectId,
          {
            progress: projectProgress,
            status: projectStatus,
          }
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: populatedTask,
    });
  } catch (error) {
    console.error("Create Task Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Tasks (with populated employee/intern names)
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("projectId", "projectName clientName")
      .populate("milestoneId", "milestoneName")
      .populate("assignedEmployee", "name email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email");

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Tasks By Project (with populated employee/intern names)
exports.getProjectTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      projectId: req.params.projectId,
    })
      .populate("assignedEmployee", "name email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email")
      .populate("milestoneId", "milestoneName");

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Tasks By Milestone (with populated employee/intern names)
exports.getMilestoneTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      milestoneId: req.params.milestoneId,
    })
      .populate("assignedEmployee", "name email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email")
      .populate("projectId", "projectName clientName");

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Tasks By Assigned Employee (with populated employee/intern names)
exports.getTasksByAssignedEmployee = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const tasks = await Task.find({
      $or: [
        { assignedEmployee: userId },
        { assignedIntern: userId }
      ]
    })
      .populate("assignedEmployee", "name email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email")
      .populate("projectId", "projectName clientName")
      .populate("milestoneId", "milestoneName");

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Single Task (with populated employee/intern names)
exports.getSingleTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("projectId", "projectName clientName")
      .populate("milestoneId", "milestoneName")
      .populate("assignedEmployee", "name email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Task Progress
exports.updateTaskProgress = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      {
        progress: req.body.progress,
        status: req.body.progress === 100 ? "completed" : "in_progress",
        completedAt: req.body.progress === 100 ? new Date() : null,
      },
      { new: true }
    )
      .populate("assignedEmployee", "name email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Task Status
exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    task.status = status;

    if (status === "completed") {
      task.progress = 100;
      task.completedAt = new Date();
    } else if (status === "in_progress") {
      if (task.progress === 0) {
        task.progress = 10;
      }
      task.completedAt = null;
    } else if (status === "pending") {
      task.progress = 0;
      task.completedAt = null;
    }

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate("assignedEmployee", "name email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email");

    // Update Milestone Progress
    if (task.milestoneId) {
      const tasks = await Task.find({
        milestoneId: task.milestoneId,
      });

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === "completed").length;
      const milestoneProgress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

      let milestoneStatus = "pending";
      if (milestoneProgress > 0 && milestoneProgress < 100) milestoneStatus = "in_progress";
      if (milestoneProgress === 100) milestoneStatus = "completed";

      const milestone = await Milestone.findByIdAndUpdate(
        task.milestoneId,
        {
          progress: milestoneProgress,
          status: milestoneStatus,
          completedAt: milestoneProgress === 100 ? new Date() : null,
        },
        { new: true }
      );

      // Update Project Progress
      if (milestone) {
        const milestones = await Milestone.find({
          projectId: milestone.projectId,
        });

        const totalMilestones = milestones.length;
        const completedMilestones = milestones.filter((m) => m.status === "completed").length;
        const projectProgress = totalMilestones === 0 ? 0 : Math.round((completedMilestones / totalMilestones) * 100);

        let projectStatus = "pending";
        if (projectProgress > 0 && projectProgress < 100) projectStatus = "in_progress";
        if (projectProgress === 100) projectStatus = "completed";

        await Project.findByIdAndUpdate(
          milestone.projectId,
          {
            progress: projectProgress,
            status: projectStatus,
          }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Task status updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Task
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Delete daily updates for this task
    await DailyUpdate.deleteMany({ taskId: task._id });

    await Task.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// MILESTONE CONTROLLER
// ======================================================

// Create Milestone
exports.createMilestone = async (req, res) => {
  try {
    const milestone = await Milestone.create(req.body);

    res.status(201).json({
      success: true,
      data: milestone,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Milestones
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
exports.getProjectMilestones = async (req, res) => {
  try {
    const milestones = await Milestone.find({
      projectId: req.params.projectId,
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

// Complete Milestone
exports.completeMilestone = async (req, res) => {
  try {
    const milestone = await Milestone.findByIdAndUpdate(
      req.params.id,
      {
        status: "completed",
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: milestone,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// DAILY UPDATE CONTROLLER
// ======================================================

// Add Daily Update
exports.addDailyUpdate = async (req, res) => {
  try {
    const update = await DailyUpdate.create(req.body);

    await Task.findByIdAndUpdate(
      req.body.taskId,
      {
        progress: req.body.progress,
      }
    );

    res.status(201).json({
      success: true,
      data: update,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Task Updates
exports.getTaskUpdates = async (req, res) => {
  try {
    const updates = await DailyUpdate.find({
      taskId: req.params.taskId,
    }).populate("userId", "name email");

    res.status(200).json({
      success: true,
      data: updates,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};