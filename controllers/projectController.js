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

/**
 * Get team lead from project with clear priority order & full resolution
 */
const getProjectTeamLead = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) return { teamLeadUser: null, teamLeadEmployee: null };

  const teamLeadUser = await resolveProjectTeamLeadUser(project);
  const teamLeadEmployee = await resolveProjectTeamLeadEmployee(project);

  return { teamLeadUser, teamLeadEmployee };
};

/**
 * Check if a user is a team lead for a specific project
 */
const isUserTeamLeadForProject = async (userId, projectId) => {
  const project = await Project.findById(projectId);
  if (!project) return false;
  
  const teamLeadUser = await resolveProjectTeamLeadUser(project);
  return teamLeadUser && teamLeadUser.toString() === userId.toString();
};

/**
 * Get all team members (including team lead) for a project
 */
const getAllProjectTeamMembers = async (projectId) => {
  const project = await Project.findById(projectId)
    .populate('teamLeadUser', 'name email')
    .populate('teamLeadEmployee', 'firstName lastName email')
    .populate('employees', 'firstName lastName email')
    .populate('interns', 'name email');
  
  if (!project) return { teamLead: null, employees: [], interns: [] };
  
  return {
    teamLead: {
      user: project.teamLeadUser,
      employee: project.teamLeadEmployee
    },
    employees: project.employees || [],
    interns: project.interns || []
  };
};

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

// Helper: Resolve Team Lead User ID with multi-level lookup & fallback
const resolveProjectTeamLeadUser = async (project = null, assignedEmployee = null, assignedIntern = null) => {
  // 1. Direct project check
  if (project?.teamLeadUser) {
    return project.teamLeadUser._id || project.teamLeadUser;
  }

  if (project?.teamLeadEmployee) {
    const empId = project.teamLeadEmployee._id || project.teamLeadEmployee;
    const employee = await Employee.findById(empId).select("userID");
    if (employee?.userID) {
      return employee.userID;
    }
  }

  if (project?.teamLead) {
    const teamId = project.teamLead._id || project.teamLead;
    const team = await Team.findById(teamId).select("teamLeadUser teamLeadEmployee");
    if (team?.teamLeadUser) {
      return team.teamLeadUser._id || team.teamLeadUser;
    }
    if (team?.teamLeadEmployee) {
      const employee = await Employee.findById(team.teamLeadEmployee).select("userID");
      if (employee?.userID) {
        return employee.userID;
      }
    }
  }

  // 2. Check Team collection matching assigned employee / intern / project employees / project interns
  const empIds = [];
  if (assignedEmployee) empIds.push(assignedEmployee._id || assignedEmployee);
  if (project?.employees?.length) {
    project.employees.forEach((e) => empIds.push(e._id || e));
  }

  const intIds = [];
  if (assignedIntern) intIds.push(assignedIntern._id || assignedIntern);
  if (project?.interns?.length) {
    project.interns.forEach((i) => intIds.push(i._id || i));
  }

  if (empIds.length > 0 || intIds.length > 0) {
    const teamQuery = [];
    if (empIds.length > 0) teamQuery.push({ employees: { $in: empIds } });
    if (intIds.length > 0) teamQuery.push({ interns: { $in: intIds } });

    const team = await Team.findOne({ $or: teamQuery });
    if (team) {
      if (team.teamLeadUser) return team.teamLeadUser._id || team.teamLeadUser;
      if (team.teamLeadEmployee) {
        const employee = await Employee.findById(team.teamLeadEmployee).select("userID");
        if (employee?.userID) return employee.userID;
      }
    }
  }

  // 3. Check if any employee in candidates is marked as isTeamLead
  if (empIds.length > 0) {
    const leadEmp = await Employee.findOne({ _id: { $in: empIds }, isTeamLead: true }).select("userID");
    if (leadEmp?.userID) return leadEmp.userID;
  }

  // 4. Check if any user in candidates has team lead role
  if (intIds.length > 0) {
    const leadUser = await User.findOne({ _id: { $in: intIds }, role: { $regex: /team\s*lead/i } }).select("_id");
    if (leadUser?._id) return leadUser._id;
  }

  // 5. Fallback: Any Team in DB with a team lead
  const globalTeam = await Team.findOne({
    $or: [
      { teamLeadUser: { $ne: null } },
      { teamLeadEmployee: { $ne: null } }
    ]
  });

  if (globalTeam) {
    if (globalTeam.teamLeadUser) return globalTeam.teamLeadUser._id || globalTeam.teamLeadUser;
    if (globalTeam.teamLeadEmployee) {
      const employee = await Employee.findById(globalTeam.teamLeadEmployee).select("userID");
      if (employee?.userID) return employee.userID;
    }
  }

  // 6. Fallback: Any Employee marked as isTeamLead
  const anyLeadEmp = await Employee.findOne({ isTeamLead: true }).select("userID");
  if (anyLeadEmp?.userID) return anyLeadEmp.userID;

  // 7. Fallback: Any User with role team lead
  const anyLeadUser = await User.findOne({ role: { $regex: /team\s*lead/i } }).select("_id");
  if (anyLeadUser?._id) return anyLeadUser._id;

  return null;
};

// Helper: Resolve Team Lead Employee ID with multi-level lookup & fallback
const resolveProjectTeamLeadEmployee = async (project = null, assignedEmployee = null, assignedIntern = null) => {
  // 1. Direct project check
  if (project?.teamLeadEmployee) {
    return project.teamLeadEmployee._id || project.teamLeadEmployee;
  }

  if (project?.teamLeadUser) {
    const userId = project.teamLeadUser._id || project.teamLeadUser;
    const employee = await Employee.findOne({ userID: userId }).select("_id");
    if (employee?._id) {
      return employee._id;
    }
  }

  if (project?.teamLead) {
    const teamId = project.teamLead._id || project.teamLead;
    const team = await Team.findById(teamId).select("teamLeadEmployee teamLeadUser");
    if (team?.teamLeadEmployee) {
      return team.teamLeadEmployee._id || team.teamLeadEmployee;
    }
    if (team?.teamLeadUser) {
      const employee = await Employee.findOne({ userID: team.teamLeadUser }).select("_id");
      if (employee?._id) {
        return employee._id;
      }
    }
  }

  // 2. Check Team collection matching assigned employee / intern / project employees / project interns
  const empIds = [];
  if (assignedEmployee) empIds.push(assignedEmployee._id || assignedEmployee);
  if (project?.employees?.length) {
    project.employees.forEach((e) => empIds.push(e._id || e));
  }

  const intIds = [];
  if (assignedIntern) intIds.push(assignedIntern._id || assignedIntern);
  if (project?.interns?.length) {
    project.interns.forEach((i) => intIds.push(i._id || i));
  }

  if (empIds.length > 0 || intIds.length > 0) {
    const teamQuery = [];
    if (empIds.length > 0) teamQuery.push({ employees: { $in: empIds } });
    if (intIds.length > 0) teamQuery.push({ interns: { $in: intIds } });

    const team = await Team.findOne({ $or: teamQuery });
    if (team) {
      if (team.teamLeadEmployee) return team.teamLeadEmployee._id || team.teamLeadEmployee;
      if (team.teamLeadUser) {
        const employee = await Employee.findOne({ userID: team.teamLeadUser }).select("_id");
        if (employee?._id) return employee._id;
      }
    }
  }

  // 3. Check if any employee in candidates is marked as isTeamLead
  if (empIds.length > 0) {
    const leadEmp = await Employee.findOne({ _id: { $in: empIds }, isTeamLead: true }).select("_id");
    if (leadEmp?._id) return leadEmp._id;
  }

  // 4. Check if any user in candidates has team lead role
  if (intIds.length > 0) {
    const leadUser = await User.findOne({ _id: { $in: intIds }, role: { $regex: /team\s*lead/i } }).select("_id");
    if (leadUser?._id) {
      const linkedEmp = await Employee.findOne({ userID: leadUser._id }).select("_id");
      if (linkedEmp?._id) return linkedEmp._id;
    }
  }

  // 5. Fallback: Any Team in DB with a team lead
  const globalTeam = await Team.findOne({
    $or: [
      { teamLeadEmployee: { $ne: null } },
      { teamLeadUser: { $ne: null } }
    ]
  });

  if (globalTeam) {
    if (globalTeam.teamLeadEmployee) return globalTeam.teamLeadEmployee._id || globalTeam.teamLeadEmployee;
    if (globalTeam.teamLeadUser) {
      const employee = await Employee.findOne({ userID: globalTeam.teamLeadUser }).select("_id");
      if (employee?._id) return employee._id;
    }
  }

  // 6. Fallback: Any Employee marked as isTeamLead
  const anyLeadEmp = await Employee.findOne({ isTeamLead: true }).select("_id");
  if (anyLeadEmp?._id) return anyLeadEmp._id;

  // 7. Fallback: Any User with role team lead
  const anyLeadUser = await User.findOne({ role: { $regex: /team\s*lead/i } }).select("_id");
  if (anyLeadUser?._id) {
    const linkedEmp = await Employee.findOne({ userID: anyLeadUser._id }).select("_id");
    if (linkedEmp?._id) return linkedEmp._id;
  }

  return null;
};

const resolveAssignedUserId = async ({ assignedEmployee, assignedIntern }) => {
  if (assignedEmployee) {
    const empId = assignedEmployee._id || assignedEmployee;
    const employee = await Employee.findById(empId).select("userID");
    if (employee?.userID) {
      return employee.userID;
    }
  }

  if (assignedIntern) {
    return assignedIntern._id || assignedIntern;
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
  assignedTeamLeadEmployee = null,
  employeeUserMap = {},
  internUserMap = {},
}) => {
  if (!projectId) {
    return [];
  }

  const tasks = [];
  const seen = new Set();

  const addTask = ({ employeeId, internId, assignedUserId, role, label }) => {
    const validUserId = assignedUserId || assignedTeamLead || assignedBy || null;
    if (!validUserId && !employeeId && !internId) {
      return;
    }

    const uniqueKey = `${String(projectId)}:${String(employeeId || internId || assignedUserId || "unknown")}:${role}:${label}`;
    if (seen.has(uniqueKey)) {
      return;
    }

    seen.add(uniqueKey);

    const taskData = {
      projectId,
      milestoneId: null,
      taskTitle: `${projectName || "Project"} - ${label}`,
      taskDescription: `Project assignment for ${projectName || "Project"}.`,
      assignedBy: assignedBy || assignedTeamLead || assignedUserId || null,
      assignedTeamLeadUser: assignedTeamLead || null,
      assignedTeamLeadEmployee: assignedTeamLeadEmployee || null,
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
      taskData.assignedEmployee = employeeId || null;
      taskData.assignedIntern = null;
    } else if (role === "intern") {
      taskData.assignedIntern = internId || null;
      taskData.assignedEmployee = null;
    }

    tasks.push(taskData);
  };

  employees.forEach((employeeId, index) => {
    const userId = employeeUserMap[String(employeeId)] || employeeUserMap[employeeId];
    if (!employeeId) {
      return;
    }
    const employeeLabel = `Employee ${index + 1}`;
    addTask({ employeeId, assignedUserId: userId, role: "employee", label: employeeLabel });
  });

  interns.forEach((internId, index) => {
    const userId = internUserMap[String(internId)] || internUserMap[internId] || internId;
    const internLabel = `Intern ${index + 1}`;
    addTask({ internId, assignedUserId: userId, role: "intern", label: internLabel });
  });

  return tasks;
};

// Helper: Auto Create Tasks on Project Save / Member Assignment
const autoCreateProjectTasks = async ({ project, assignedBy }) => {
  if (!project) return [];
  
  const employees = Array.isArray(project.employees) ? project.employees : [];
  const interns = Array.isArray(project.interns) ? project.interns : [];
  
  // Get team lead info
  const teamLeadUser = await resolveProjectTeamLeadUser(project);
  const teamLeadEmployee = await resolveProjectTeamLeadEmployee(project);
  
  // Create a task for team lead to oversee the project
  const teamLeadTask = {
    projectId: project._id,
    milestoneId: null,
    taskTitle: `${project.projectName} - Team Lead Oversight`,
    taskDescription: `Team lead oversight for project ${project.projectName}`,
    assignedBy: assignedBy || teamLeadUser || null,
    assignedTeamLeadUser: teamLeadUser || null,
    assignedTeamLeadEmployee: teamLeadEmployee || null,
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    estimatedHours: 0,
    priority: "high",
    status: "pending",
    progress: 0
  };
  
  const allTasks = [];
  
  // Add team lead task if team lead exists
  if (teamLeadUser || teamLeadEmployee) {
    allTasks.push(teamLeadTask);
  }
  
  // Create tasks for employees
  employees.forEach((employeeId, index) => {
    const empId = employeeId._id || employeeId;
    const task = {
      projectId: project._id,
      milestoneId: null,
      taskTitle: `${project.projectName} - Employee Task ${index + 1}`,
      taskDescription: `Project assignment for ${project.projectName}.`,
      assignedBy: assignedBy || teamLeadUser || null,
      assignedTeamLeadUser: teamLeadUser || null,
      assignedTeamLeadEmployee: teamLeadEmployee || null,
      assignedEmployee: empId,
      assignedIntern: null,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedHours: 0,
      priority: "medium",
      status: "pending",
      progress: 0
    };
    allTasks.push(task);
  });
  
  // Create tasks for interns
  interns.forEach((internId, index) => {
    const intId = internId._id || internId;
    const task = {
      projectId: project._id,
      milestoneId: null,
      taskTitle: `${project.projectName} - Intern Task ${index + 1}`,
      taskDescription: `Project assignment for ${project.projectName}.`,
      assignedBy: assignedBy || teamLeadUser || null,
      assignedTeamLeadUser: teamLeadUser || null,
      assignedTeamLeadEmployee: teamLeadEmployee || null,
      assignedEmployee: null,
      assignedIntern: intId,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedHours: 0,
      priority: "medium",
      status: "pending",
      progress: 0
    };
    allTasks.push(task);
  });
  
  // Create all tasks with deduplication and backfill team lead if missing
  const createdTasks = [];
  for (const task of allTasks) {
    const existingTask = await Task.findOne({
      projectId: task.projectId,
      taskTitle: task.taskTitle,
      $or: [
        { assignedEmployee: task.assignedEmployee },
        { assignedIntern: task.assignedIntern },
        { assignedTeamLeadUser: task.assignedTeamLeadUser }
      ]
    });
    
    if (existingTask) {
      let updated = false;
      if (!existingTask.assignedTeamLeadUser && task.assignedTeamLeadUser) {
        existingTask.assignedTeamLeadUser = task.assignedTeamLeadUser;
        updated = true;
      }
      if (!existingTask.assignedTeamLeadEmployee && task.assignedTeamLeadEmployee) {
        existingTask.assignedTeamLeadEmployee = task.assignedTeamLeadEmployee;
        updated = true;
      }
      if (updated) {
        await existingTask.save();
      }
      createdTasks.push(existingTask);
    } else {
      const createdTask = await Task.create(task);
      createdTasks.push(createdTask);
    }
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
// Get All Projects - Updated to properly fetch team lead names
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("teamLeadUser", "name email employeeID")
      .populate("teamLeadEmployee", "name email employeeID")
      .populate("employees", "name email employeeID")
      .populate("interns", "name email");

    // Process each project to resolve team lead name if not directly populated
    const processedProjects = await Promise.all(projects.map(async (project) => {
      const projectObj = project.toObject();
      
      // If teamLeadUser is null but we have employees or interns, try to find team lead
      if (!projectObj.teamLeadUser && !projectObj.teamLeadEmployee) {
        // Try to find team lead from employees with isTeamLead flag
        if (projectObj.employees && projectObj.employees.length > 0) {
          for (const emp of projectObj.employees) {
            const employee = await Employee.findById(emp._id || emp);
            if (employee && employee.isTeamLead) {
              projectObj.teamLeadEmployee = employee;
              // Also get the user associated with this employee
              if (employee.userID) {
                const user = await User.findById(employee.userID).select("name email");
                if (user) {
                  projectObj.teamLeadUser = user;
                }
              }
              break;
            }
          }
        }
        
        // If still no team lead, try to find from interns
        if (!projectObj.teamLeadUser && !projectObj.teamLeadEmployee) {
          if (projectObj.interns && projectObj.interns.length > 0) {
            for (const intern of projectObj.interns) {
              const user = await User.findById(intern._id || intern);
              if (user && user.role && user.role.toLowerCase().includes("team lead")) {
                projectObj.teamLeadUser = user;
                break;
              }
            }
          }
        }

        // Fallback: Try to find any user with team lead role in the system
        if (!projectObj.teamLeadUser && !projectObj.teamLeadEmployee) {
          const anyLeadUser = await User.findOne({ 
            role: { $regex: /team\s*lead/i } 
          }).select("name email");
          if (anyLeadUser) {
            projectObj.teamLeadUser = anyLeadUser;
          }
        }
      }

      // If teamLeadUser is populated but we want to ensure the name is there
      if (projectObj.teamLeadUser && typeof projectObj.teamLeadUser === 'object') {
        // Already populated
      }

      return projectObj;
    }));

    res.status(200).json({
      success: true,
      data: processedProjects,
    });
  } catch (error) {
    console.error("Get All Projects Error:", error);
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

    // STEP A: Support alias keys in request body
    if (!taskData.taskTitle && taskData.title) {
      taskData.taskTitle = taskData.title;
    }
    if (!taskData.taskDescription && taskData.description) {
      taskData.taskDescription = taskData.description;
    }
    if (taskData.assignedTo && !taskData.assignedEmployee && !taskData.assignedIntern) {
      const targetId = taskData.assignedTo;
      const emp = await Employee.findById(targetId);
      if (emp) {
        taskData.assignedEmployee = emp._id;
      } else {
        const usr = await User.findById(targetId);
        if (usr) {
          const linkedEmp = await Employee.findOne({ userID: usr._id });
          if (linkedEmp) {
            taskData.assignedEmployee = linkedEmp._id;
          } else if (String(usr.role || "").toLowerCase().includes("intern")) {
            taskData.assignedIntern = usr._id;
          } else {
            taskData.assignedEmployee = usr._id;
          }
        }
      }
    }
    if (!taskData.assignedTeamLeadUser && (taskData.teamLeadUser || taskData.teamLeadUserId)) {
      taskData.assignedTeamLeadUser = taskData.teamLeadUser || taskData.teamLeadUserId;
    }
    if (!taskData.assignedTeamLeadEmployee && (taskData.teamLeadEmployee || taskData.teamLeadEmployeeId)) {
      taskData.assignedTeamLeadEmployee = taskData.teamLeadEmployee || taskData.teamLeadEmployeeId;
    }
    if (!taskData.assignedBy && (taskData.assignedByUser || taskData.userId)) {
      taskData.assignedBy = taskData.assignedByUser || taskData.userId;
    }

    // STEP B: Resolve projectId from milestoneId if projectId is not provided directly
    if (!taskData.projectId && taskData.milestoneId) {
      const milestone = await Milestone.findById(taskData.milestoneId);
      if (milestone?.projectId) {
        taskData.projectId = milestone.projectId;
      }
    }

    let project = null;
    if (taskData.projectId) {
      project = await Project.findById(taskData.projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found"
        });
      }

      // Auto-assign employee/intern from project if neither assignedEmployee nor assignedIntern is provided
      if (!taskData.assignedEmployee && !taskData.assignedIntern) {
        if (project.employees && project.employees.length > 0) {
          taskData.assignedEmployee = project.employees[0];
        }
        if (project.interns && project.interns.length > 0) {
          taskData.assignedIntern = project.interns[0];
        }
      }
    }

    // STEP C: Resolve Team Lead User and Team Lead Employee (multi-level check: Project -> Team -> Employee isTeamLead -> User Role -> Fallbacks)
    const teamLeadUser = await resolveProjectTeamLeadUser(project, taskData.assignedEmployee, taskData.assignedIntern);
    const teamLeadEmployee = await resolveProjectTeamLeadEmployee(project, taskData.assignedEmployee, taskData.assignedIntern);

    // If project exists, auto-save resolved Team Lead back onto the project if missing
    if (project) {
      let projectNeedsSave = false;
      if (!project.teamLeadUser && teamLeadUser) {
        project.teamLeadUser = teamLeadUser;
        projectNeedsSave = true;
      }
      if (!project.teamLeadEmployee && teamLeadEmployee) {
        project.teamLeadEmployee = teamLeadEmployee;
        projectNeedsSave = true;
      }
      if (projectNeedsSave) {
        await project.save();
      }
    }

    // Auto-assign Team Lead User & Employee if not explicitly passed in taskData
    if (!taskData.assignedTeamLeadUser && teamLeadUser) {
      taskData.assignedTeamLeadUser = teamLeadUser;
    }
    if (!taskData.assignedTeamLeadEmployee && teamLeadEmployee) {
      taskData.assignedTeamLeadEmployee = teamLeadEmployee;
    }

    // If teamLeadEmployee is set but teamLeadUser isn't, resolve User from Employee
    if (taskData.assignedTeamLeadEmployee && !taskData.assignedTeamLeadUser) {
      const emp = await Employee.findById(taskData.assignedTeamLeadEmployee).select("userID");
      if (emp?.userID) {
        taskData.assignedTeamLeadUser = emp.userID;
      }
    }
    // If teamLeadUser is set but teamLeadEmployee isn't, resolve Employee from User
    if (taskData.assignedTeamLeadUser && !taskData.assignedTeamLeadEmployee) {
      const emp = await Employee.findOne({ userID: taskData.assignedTeamLeadUser }).select("_id");
      if (emp?._id) {
        taskData.assignedTeamLeadEmployee = emp._id;
      }
    }

    // Set assignedBy to TL User or req.user or fallback
    if (!taskData.assignedBy) {
      const fallbackUser = await resolveAssignedUserId({
        assignedEmployee: taskData.assignedEmployee,
        assignedIntern: taskData.assignedIntern,
      });

      taskData.assignedBy =
        req.user?._id ||
        taskData.assignedTeamLeadUser ||
        teamLeadUser ||
        fallbackUser ||
        null;
    }

    // Validate that at least one assignee exists
    if (!taskData.assignedEmployee && !taskData.assignedIntern && !taskData.assignedTeamLeadUser) {
      return res.status(400).json({
        success: false,
        message: "Task must be assigned to at least one person (employee, intern, or team lead)"
      });
    }
    
    // Create the task
    const task = await Task.create(taskData);
    
    // Populate task references and return
    const populatedTask = await Task.findById(task._id)
      .populate("assignedEmployee", "firstName lastName email")
      .populate("assignedIntern", "name email")
      .populate("assignedTeamLeadUser", "name email")
      .populate("assignedTeamLeadEmployee", "firstName lastName email")
      .populate("assignedBy", "name email")
      .populate("projectId", "projectName clientName")
      .populate("milestoneId", "milestoneName title");
    
    // Recalculate milestone and project progress
    await recalculateMilestoneAndProjectProgress(task.milestoneId, task.projectId);
    
    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: populatedTask
    });
    
  } catch (error) {
    console.error("Create Task Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
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
      .populate("assignedTeamLeadUser", "name email")
      .populate("assignedTeamLeadEmployee", "firstName lastName email")
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
      .populate("assignedTeamLeadUser", "name email")
      .populate("assignedTeamLeadEmployee", "firstName lastName email")
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
      .populate("assignedTeamLeadUser", "name email")
      .populate("assignedTeamLeadEmployee", "firstName lastName email")
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

// Get Tasks By Assigned Employee or Team Lead
exports.getTasksByAssignedEmployee = async (req, res) => {
  try {
    const { userId } = req.params;

    const tasks = await Task.find({
      $or: [
        { assignedEmployee: userId },
        { assignedIntern: userId },
        { assignedTeamLeadUser: userId },
        { assignedTeamLeadEmployee: userId }
      ],
    })
      .populate("assignedEmployee", "name firstName lastName email")
      .populate("assignedIntern", "name email")
      .populate("assignedTeamLeadUser", "name email")
      .populate("assignedTeamLeadEmployee", "firstName lastName email")
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
      .populate("assignedTeamLeadUser", "name email")
      .populate("assignedTeamLeadEmployee", "firstName lastName email")
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
      .populate("assignedTeamLeadUser", "name email")
      .populate("assignedTeamLeadEmployee", "firstName lastName email")
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
      .populate("assignedTeamLeadUser", "name email")
      .populate("assignedTeamLeadEmployee", "firstName lastName email")
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

// Update Task (General updates)
exports.updateTask = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (!updateData.taskTitle && updateData.title) {
      updateData.taskTitle = updateData.title;
    }
    if (!updateData.taskDescription && updateData.description) {
      updateData.taskDescription = updateData.description;
    }
    if (updateData.assignedTo && !updateData.assignedEmployee) {
      updateData.assignedEmployee = updateData.assignedTo;
    }

    if (updateData.progress !== undefined) {
      const p = Number(updateData.progress);
      updateData.progress = p;
      if (p === 100) {
        updateData.status = "completed";
        updateData.completedAt = new Date();
      }
    }

    const task = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate("assignedEmployee", "name firstName lastName email")
      .populate("assignedIntern", "name email")
      .populate("assignedTeamLeadUser", "name email")
      .populate("assignedTeamLeadEmployee", "firstName lastName email")
      .populate("assignedBy", "name email")
      .populate("projectId", "projectName clientName")
      .populate("milestoneId", "milestoneName title");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    await recalculateMilestoneAndProjectProgress(task.milestoneId, task.projectId);

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: task,
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
    // Validate required fields explicitly
    const { projectId, title, dueDate } = req.body;
    
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }
    
    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Due date is required'
      });
    }

    // Create milestone with all fields
    const milestone = await Milestone.create({
      projectId: req.body.projectId,
      title: req.body.title,
      description: req.body.description || '',
      dueDate: req.body.dueDate,
      progress: req.body.progress || 0,
      status: req.body.status || 'pending',
      reviewComment: req.body.reviewComment || '',
      completedAt: req.body.completedAt || null
    });

    // Recalculate Project Progress if necessary
    if (milestone.projectId) {
      await recalculateMilestoneAndProjectProgress(milestone._id, milestone.projectId);
    }

    res.status(201).json({
      success: true,
      data: milestone,
    });
  } catch (error) {
    // Better error handling
    console.error('Error creating milestone:', error);
    
    // Handle validation errors from Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
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