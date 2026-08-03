const Project = require("../models/projectModel");
const Task = require("../models/taskModel");
const Milestone = require("../models/milestoneModel");
const DailyUpdate = require("../models/dailyUpdateModel");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");

// ======================================================
// HELPER FUNCTIONS FOR TEAM & PROGRESS MANAGEMENT
// ======================================================

// Helper: Automatically Fetch Team Members from Team Collection based on Team Lead
const fetchTeamMembersByTeamLead = async ({ teamLead, teamLeadUser, teamLeadEmployee }) => {
  const query = [];
  if (teamLead) query.push({ _id: teamLead });
  if (teamLeadUser) query.push({ teamLeadUser });
  if (teamLeadEmployee) query.push({ teamLeadEmployee });

  if (query.length === 0) {
    return { employees: [], interns: [], teamLeadUser: null, teamLeadEmployee: null };
  }

  const team = await Team.findOne({ $or: query });
  if (team) {
    return {
      employees: team.employees || [],
      interns: team.interns || [],
      teamLeadUser: team.teamLeadUser || null,
      teamLeadEmployee: team.teamLeadEmployee || null,
    };
  }

  return { employees: [], interns: [], teamLeadUser: null, teamLeadEmployee: null };
};

// Helper: Resolve Team Lead User ID
const resolveProjectTeamLeadUser = async (project) => {
  if (!project) {
    return null;
  }

  if (project.teamLeadUser) {
    return project.teamLeadUser;
  }

  if (project.teamLeadEmployee) {
    const employee = await Employee.findById(project.teamLeadEmployee).select("userID");
    if (employee?.userID) {
      return employee.userID;
    }
  }

  if (project.teamLead) {
    const team = await Team.findById(project.teamLead).select("teamLeadUser");
    if (team?.teamLeadUser) {
      return team.teamLeadUser;
    }
  }

  return null;
};

// Helper: Build Task Assignment Objects
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
      assignedTeamLeadUser: assignedTeamLead || null,
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
    const userId = employeeUserMap[String(employeeId)] || employeeUserMap[employeeId];
    if (!userId) {
      return;
    }
    const employeeLabel = `Employee ${index + 1}`;
    addTask({ userId, role: "employee", label: employeeLabel });
  });

  interns.forEach((internId, index) => {
    const userId = internUserMap[String(internId)] || internUserMap[internId] || internId;
    const internLabel = `Intern ${index + 1}`;
    addTask({ userId, role: "intern", label: internLabel });
  });

  return tasks;
};

// Helper: Auto Create Tasks on Project Save / Member Assignment
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

  const employeeUserMap = {};
  if (employees.length > 0) {
    const employeeRecords = await Employee.find({ _id: { $in: employees } })
      .select("_id userID firstName lastName")
      .populate("userID", "name email");

    employeeRecords.forEach((employee) => {
      if (employee.userID) {
        const userId = employee.userID._id || employee.userID;
        employeeUserMap[String(employee._id)] = userId;
      }
    });
  }

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
        { assignedIntern: task.assignedIntern },
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

// Helper: Cascading Progress Update (Task Progress -> Milestone Progress -> Project Progress)
const recalculateMilestoneAndProjectProgress = async (milestoneId, targetProjectId = null) => {
  let pId = targetProjectId;

  if (milestoneId) {
    const milestone = await Milestone.findById(milestoneId);
    if (milestone && milestone.projectId) {
      pId = milestone.projectId;
    }

    const tasks = await Task.find({ milestoneId });
    const totalTasks = tasks.length;

    const milestoneProgress =
      totalTasks === 0
        ? 0
        : Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks);

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

  if (pId) {
    const milestones = await Milestone.find({ projectId: pId });
    let projectProgress = 0;

    if (milestones.length > 0) {
      projectProgress = Math.round(
        milestones.reduce((sum, m) => sum + (m.progress || 0), 0) / milestones.length
      );
    } else {
      const projectTasks = await Task.find({ projectId: pId });
      if (projectTasks.length > 0) {
        projectProgress = Math.round(
          projectTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / projectTasks.length
        );
      }
    }

    let projectStatus = "pending";
    if (projectProgress > 0 && projectProgress < 100) {
      projectStatus = "in_progress";
    } else if (projectProgress === 100) {
      projectStatus = "completed";
    }

    await Project.findByIdAndUpdate(pId, {
      progress: projectProgress,
      status: projectStatus,
    });
  }
};

module.exports.buildProjectAssignmentTasks = buildProjectAssignmentTasks;
module.exports.autoCreateProjectTasks = autoCreateProjectTasks;
module.exports.recalculateMilestoneAndProjectProgress = recalculateMilestoneAndProjectProgress;

// ======================================================
// PROJECT CONTROLLER
// ======================================================

// Create Project: Auto Fetches Team Members (Employee + Intern) from Team Collection if Team Lead is selected
exports.createProject = async (req, res) => {
  try {
    const uploadedFiles = req.files
      ? req.files.map((file) => ({
          fileName: file.originalname,
          fileUrl: file.path,
        }))
      : [];

    let { teamLead, teamLeadUser, teamLeadEmployee, employees = [], interns = [] } = req.body;

    // Automatically Fetch Team Members (Employee + Intern) from Team Collection if Team Lead provided
    if (teamLead || teamLeadUser || teamLeadEmployee) {
      const teamData = await fetchTeamMembersByTeamLead({ teamLead, teamLeadUser, teamLeadEmployee });
      if (!teamLeadUser && teamData.teamLeadUser) teamLeadUser = teamData.teamLeadUser;
      if (!teamLeadEmployee && teamData.teamLeadEmployee) teamLeadEmployee = teamData.teamLeadEmployee;

      if (!employees || employees.length === 0) {
        employees = teamData.employees;
      }
      if (!interns || interns.length === 0) {
        interns = teamData.interns;
      }
    }

    const project = await Project.create({
      ...req.body,
      teamLeadUser: teamLeadUser || null,
      teamLeadEmployee: teamLeadEmployee || null,
      employees,
      interns,
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

// Automatically Fetch Project Members (Team Lead + Employees + Interns) for Task Assignment
exports.getProjectMembers = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId)
      .populate("teamLeadUser", "name email role")
      .populate("teamLeadEmployee", "firstName lastName email employeeID")
      .populate("employees", "firstName lastName email employeeID userID")
      .populate("interns", "name email role");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        teamLeadUser: project.teamLeadUser,
        teamLeadEmployee: project.teamLeadEmployee,
        employees: project.employees,
        interns: project.interns,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Assign Team Lead & Auto Fetch Team Members
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

    // Also check if Team collection has members for this Team Lead
    const teamData = await fetchTeamMembersByTeamLead({
      teamLead: teamLeadId,
      teamLeadUser: resolvedTeamLeadUser,
      teamLeadEmployee: resolvedTeamLeadEmployee,
    });

    const updateFields = {
      teamLeadUser: resolvedTeamLeadUser || null,
      teamLeadEmployee: resolvedTeamLeadEmployee || null,
    };

    if (teamData.employees.length > 0 || teamData.interns.length > 0) {
      const currentProject = await Project.findById(req.params.id);
      if (currentProject) {
        if (!currentProject.employees || currentProject.employees.length === 0) {
          updateFields.employees = teamData.employees;
        }
        if (!currentProject.interns || currentProject.interns.length === 0) {
          updateFields.interns = teamData.interns;
        }
      }
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      updateFields,
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

    // Automatically Fetch & Assign From Project Members if not explicitly provided
    if (taskData.projectId) {
      const project = await Project.findById(taskData.projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      if (!taskData.assignedEmployee && project.employees && project.employees.length > 0) {
        taskData.assignedEmployee = project.employees[0];
      }

      if (!taskData.assignedIntern && project.interns && project.interns.length > 0) {
        taskData.assignedIntern = project.interns[0];
      }

      if (!taskData.assignedTeamLeadUser && project.teamLeadUser) {
        taskData.assignedTeamLeadUser = project.teamLeadUser;
      }

      if (!taskData.assignedTeamLeadEmployee && project.teamLeadEmployee) {
        taskData.assignedTeamLeadEmployee = project.teamLeadEmployee;
      }

      if (!taskData.assignedBy) {
        taskData.assignedBy = req.user?._id || taskData.assignedTeamLeadUser || null;
      }
    }

    const task = await Task.create(taskData);

    const populatedTask = await Task.findById(task._id)
      .populate("assignedEmployee", "firstName lastName email")
      .populate("assignedIntern", "name email")
      .populate("assignedTeamLeadUser", "name email")
      .populate("assignedTeamLeadEmployee", "firstName lastName email")
      .populate("assignedBy", "name email");

    // Recalculate Milestone & Project Progress
    await recalculateMilestoneAndProjectProgress(task.milestoneId, task.projectId);

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

// Get All Tasks
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("projectId", "projectName clientName")
      .populate("milestoneId", "milestoneName title")
      .populate("assignedEmployee", "name firstName lastName email")
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

// Get Tasks By Project
exports.getProjectTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      projectId: req.params.projectId,
    })
      .populate("assignedEmployee", "name firstName lastName email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email")
      .populate("milestoneId", "milestoneName title");

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

// Get Tasks By Milestone
exports.getMilestoneTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      milestoneId: req.params.milestoneId,
    })
      .populate("assignedEmployee", "name firstName lastName email")
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

// Get Tasks By Assigned Employee
exports.getTasksByAssignedEmployee = async (req, res) => {
  try {
    const { userId } = req.params;

    const tasks = await Task.find({
      $or: [{ assignedEmployee: userId }, { assignedIntern: userId }],
    })
      .populate("assignedEmployee", "name firstName lastName email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email")
      .populate("projectId", "projectName clientName")
      .populate("milestoneId", "milestoneName title");

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

// Get Single Task
exports.getSingleTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("projectId", "projectName clientName")
      .populate("milestoneId", "milestoneName title")
      .populate("assignedEmployee", "name firstName lastName email")
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

// Update Task Progress (Cascades to Milestone Progress & Project Progress)
exports.updateTaskProgress = async (req, res) => {
  try {
    const progressVal = Number(req.body.progress);
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      {
        progress: progressVal,
        status: progressVal === 100 ? "completed" : "in_progress",
        completedAt: progressVal === 100 ? new Date() : null,
      },
      { new: true }
    )
      .populate("assignedEmployee", "name firstName lastName email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Cascade update to Milestone & Project progress
    await recalculateMilestoneAndProjectProgress(task.milestoneId, task.projectId);

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

// Update Task Status (Cascades to Milestone Progress & Project Progress)
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
      .populate("assignedEmployee", "name firstName lastName email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email");

    // Cascade update to Milestone & Project progress
    await recalculateMilestoneAndProjectProgress(task.milestoneId, task.projectId);

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

// Delete Task (Cascades to recalculating Milestone & Project Progress)
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const milestoneId = task.milestoneId;
    const projectId = task.projectId;

    await DailyUpdate.deleteMany({ taskId: task._id });
    await Task.findByIdAndDelete(req.params.id);

    // Recalculate progress after deletion
    await recalculateMilestoneAndProjectProgress(milestoneId, projectId);

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

    // Recalculate Project Progress if necessary
    if (milestone.projectId) {
      await recalculateMilestoneAndProjectProgress(milestone._id, milestone.projectId);
    }

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
    const milestones = await Milestone.find().populate("projectId", "projectName clientName");

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
        progress: 100,
        completedAt: new Date(),
      },
      { new: true }
    );

    if (milestone) {
      await recalculateMilestoneAndProjectProgress(milestone._id, milestone.projectId);
    }

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

// Add Daily Update (Updates Task Progress & Cascades to Milestone + Project)
exports.addDailyUpdate = async (req, res) => {
  try {
    const update = await DailyUpdate.create(req.body);

    const task = await Task.findByIdAndUpdate(
      req.body.taskId,
      {
        progress: req.body.progress,
        status: req.body.progress === 100 ? "completed" : "in_progress",
        completedAt: req.body.progress === 100 ? new Date() : null,
      },
      { new: true }
    );

    if (task) {
      await recalculateMilestoneAndProjectProgress(task.milestoneId, task.projectId);
    }

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