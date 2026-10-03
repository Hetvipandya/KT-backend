const TaskManagement = require("../models/taskModel");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Project = require("../models/projectModel");

const getBaseUrl = (req) => {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  if (req) {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.get("host") || "localhost:5000";
    return `${protocol}://${host}`;
  }
  return "http://localhost:5000";
};

const formatFileUrl = (url, req) => {
  if (!url) return "";
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  } 
  const baseUrl = getBaseUrl(req);
  const cleanPath = trimmed.replace(/\\/g, "/");
  if (cleanPath.startsWith("/uploads/")) {
    return `${baseUrl}${cleanPath}`;
  }
  if (cleanPath.startsWith("uploads/")) {
    return `${baseUrl}/${cleanPath}`;
  }
  if (cleanPath.startsWith("/")) {
    return `${baseUrl}/uploads${cleanPath}`;
  }
  return `${baseUrl}/uploads/${cleanPath}`;
};

const sanitizeTaskWithAttachments = (taskDoc, req) => {
  if (!taskDoc) return taskDoc;
  const task = typeof taskDoc.toObject === "function" ? taskDoc.toObject() : { ...taskDoc };
  if (task.attachments && Array.isArray(task.attachments)) {
    task.attachments = task.attachments.map((att) => {
      if (typeof att === "string") {
        const fileName = att.split("/").pop() || att;
        return {
          fileName,
          fileUrl: formatFileUrl(att, req),
          uploadedAt: new Date(),
        };
      }
      if (att && typeof att === "object") {
        const rawUrl = att.fileUrl || att.url || att.path || att.fileName || "";
        const fileName = att.fileName || rawUrl.split("/").pop() || "attachment";
        return {
          ...att,
          fileName,
          fileUrl: formatFileUrl(rawUrl, req),
        };
      }
      return att;
    });
  }
  return task;
};

const formatEmployeeData = (emp) => {
  if (!emp) return null;
  const raw = typeof emp.toObject === "function" ? emp.toObject() : { ...emp };
  const firstName = raw.firstName || "";
  const middleName = raw.middleName || "";
  const lastName = raw.lastName || "";
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
  const simpleName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const name = (raw.name || fullName || simpleName || raw.fullName || "").trim();

  return {
    _id: raw._id,
    name: name || "Unknown",
    email: raw.email || "",
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(raw.employeeID ? { employeeID: raw.employeeID } : {}),
    ...(raw.employeeCode ? { employeeCode: raw.employeeCode } : {}),
    ...(raw.userID ? { userID: raw.userID } : {}),
    ...(raw.userId ? { userId: raw.userId } : {}),
  };
};

const resolveTasksWithEmployees = async (tasks, req) => {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  const employeeIdsByTask = new Map();
  const teamLeadEmployeeIdsByTask = new Map();
  const teamLeadUserIdsByTask = new Map();

  tasks.forEach((task) => {
    const taskId = String(task._id);
    employeeIdsByTask.set(
      taskId,
      task.assignedEmployee ? String(task.assignedEmployee._id || task.assignedEmployee) : null
    );
    teamLeadEmployeeIdsByTask.set(
      taskId,
      task.assignedTeamLeadEmployee ? String(task.assignedTeamLeadEmployee._id || task.assignedTeamLeadEmployee) : null
    );
    teamLeadUserIdsByTask.set(
      taskId,
      task.assignedTeamLeadUser ? String(task.assignedTeamLeadUser._id || task.assignedTeamLeadUser) : null
    );
  });

  await TaskManagement.populate(tasks, [
    {
      path: "projectId",
      select: "projectName clientName employees teamLeadUser teamLeadEmployee",
      populate: [
        { path: "teamLeadUser", select: "name email" },
        { path: "teamLeadEmployee", select: "name firstName middleName lastName email employeeID employeeCode" },
        { path: "employees", select: "name firstName middleName lastName email employeeID employeeCode" },
      ],
    },
    { path: "milestoneId", select: "milestoneName title" },
    { path: "assignedEmployee", select: "name firstName middleName lastName email employeeID employeeCode" },
    { path: "assignedIntern", select: "name firstName middleName lastName email" },
    { path: "assignedTeamLeadUser", select: "name email" },
    { path: "assignedTeamLeadEmployee", select: "name firstName middleName lastName email employeeID employeeCode" },
    { path: "assignedBy", select: "name email" },
    { path: "comments.commentedBy", select: "name email" },
  ]);

  const unresolvedEmployeeIds = new Set();
  tasks.forEach((task) => {
    const taskId = String(task._id);
    const empId = employeeIdsByTask.get(taskId);
    if (empId && (!task.assignedEmployee || !task.assignedEmployee.name)) {
      unresolvedEmployeeIds.add(empId);
    }
    const tlEmpId = teamLeadEmployeeIdsByTask.get(taskId);
    if (tlEmpId && (!task.assignedTeamLeadEmployee || !task.assignedTeamLeadEmployee.name)) {
      unresolvedEmployeeIds.add(tlEmpId);
    }
    const tlUserId = teamLeadUserIdsByTask.get(taskId);
    if (tlUserId && (!task.assignedTeamLeadUser || !task.assignedTeamLeadUser.name)) {
      unresolvedEmployeeIds.add(tlUserId);
    }
  });

  const employeeCache = new Map();
  if (unresolvedEmployeeIds.size > 0) {
    const idList = Array.from(unresolvedEmployeeIds);
    const [fallbackEmployees, fallbackUsers] = await Promise.all([
      Employee.find({
        $or: [
          { _id: { $in: idList } },
          { userID: { $in: idList } },
          { userId: { $in: idList } },
          { employeeID: { $in: idList } },
        ],
      }).select("name firstName middleName lastName email employeeID employeeCode userID userId"),
      User.find({
        _id: { $in: idList },
      }).select("name email"),
    ]);

    fallbackEmployees.forEach((emp) => {
      const formatted = formatEmployeeData(emp);
      employeeCache.set(String(emp._id), formatted);
      if (emp.userID) employeeCache.set(String(emp.userID), formatted);
      if (emp.userId) employeeCache.set(String(emp.userId), formatted);
      if (emp.employeeID) employeeCache.set(String(emp.employeeID), formatted);
    });

    fallbackUsers.forEach((usr) => {
      const usrId = String(usr._id);
      if (!employeeCache.has(usrId)) {
        employeeCache.set(usrId, {
          _id: usr._id,
          name: usr.name || "",
          email: usr.email || "",
        });
      }
    });
  }

  return tasks.map((task) => {
    const taskData = typeof task.toObject === "function" ? task.toObject() : { ...task };
    const taskId = String(taskData._id);
    const rawEmpId = employeeIdsByTask.get(taskId);
    const rawTlEmpId = teamLeadEmployeeIdsByTask.get(taskId);
    const rawTlUserId = teamLeadUserIdsByTask.get(taskId);

    // Format or resolve assignedTeamLeadEmployee
    if (!taskData.assignedTeamLeadEmployee && rawTlEmpId && employeeCache.has(rawTlEmpId)) {
      taskData.assignedTeamLeadEmployee = employeeCache.get(rawTlEmpId);
    } else if (taskData.assignedTeamLeadEmployee) {
      taskData.assignedTeamLeadEmployee = formatEmployeeData(taskData.assignedTeamLeadEmployee);
    }

    // Format or resolve assignedTeamLeadUser
    if (!taskData.assignedTeamLeadUser && rawTlUserId && employeeCache.has(rawTlUserId)) {
      taskData.assignedTeamLeadUser = employeeCache.get(rawTlUserId);
    } else if (taskData.assignedTeamLeadUser && typeof taskData.assignedTeamLeadUser === "object") {
      taskData.assignedTeamLeadUser = {
        _id: taskData.assignedTeamLeadUser._id,
        name: taskData.assignedTeamLeadUser.name || "",
        email: taskData.assignedTeamLeadUser.email || "",
      };
    }

    // Format or resolve assignedEmployee
    if (!taskData.assignedEmployee && rawEmpId && employeeCache.has(rawEmpId)) {
      taskData.assignedEmployee = employeeCache.get(rawEmpId);
    } else if (taskData.assignedEmployee) {
      taskData.assignedEmployee = formatEmployeeData(taskData.assignedEmployee);
    }

    // Fallback 1: If assignedEmployee is still missing, fallback to assignedTeamLeadEmployee or assignedTeamLeadUser
    if (!taskData.assignedEmployee) {
      if (taskData.assignedTeamLeadEmployee) {
        taskData.assignedEmployee = taskData.assignedTeamLeadEmployee;
      } else if (taskData.assignedTeamLeadUser) {
        taskData.assignedEmployee = taskData.assignedTeamLeadUser;
      }
    }

    // Fallback 2: If assignedEmployee is still missing, fallback to project's employees or team lead
    if (!taskData.assignedEmployee && taskData.projectId && typeof taskData.projectId === "object") {
      const proj = taskData.projectId;
      if (Array.isArray(proj.employees) && proj.employees.length > 0) {
        taskData.assignedEmployee = formatEmployeeData(proj.employees[0]);
      } else if (proj.teamLeadEmployee) {
        taskData.assignedEmployee = formatEmployeeData(proj.teamLeadEmployee);
      } else if (proj.teamLeadUser) {
        taskData.assignedEmployee = formatEmployeeData(proj.teamLeadUser);
      }
    }

    // Format assignedIntern
    if (taskData.assignedIntern && typeof taskData.assignedIntern === "object") {
      taskData.assignedIntern = {
        _id: taskData.assignedIntern._id,
        name: taskData.assignedIntern.name || "",
        email: taskData.assignedIntern.email || "",
      };
    }

    // Format projectId cleanly
    if (taskData.projectId && typeof taskData.projectId === "object") {
      const proj = taskData.projectId;
      taskData.projectId = {
        _id: proj._id,
        projectName: proj.projectName || "",
        ...(proj.clientName ? { clientName: proj.clientName } : {}),
      };
    }

    // Compute employeeName
    const resolvedEmployeeName =
      taskData.assignedEmployee?.name ||
      taskData.assignedTeamLeadEmployee?.name ||
      taskData.assignedTeamLeadUser?.name ||
      taskData.assignedIntern?.name ||
      "";

    if (resolvedEmployeeName) {
      taskData.employeeName = resolvedEmployeeName;
    }

    return sanitizeTaskWithAttachments(taskData, req);
  });
};

exports.formatFileUrl = formatFileUrl;
exports.sanitizeTaskWithAttachments = sanitizeTaskWithAttachments;
exports.formatEmployeeData = formatEmployeeData;
exports.resolveTasksWithEmployees = resolveTasksWithEmployees;

const normalizeTaskStatus = (status) => {
  if (!status || typeof status !== "string") return "pending";

  const trimmed = status.trim();
  if (!trimmed) return "pending";

  const map = {
    assigned: "pending",
    pending: "pending",
    "in progress": "in_progress",
    in_progress: "in_progress",
    testing: "testing",
    review: "review",
    completed: "completed",
    cancelled: "cancelled",
    delayed: "delayed",
  };

  const key = trimmed.toLowerCase();
  return map[key] || key.replace(/\s+/g, "_");
};

const getProgressForStatus = (status) => {
  const normalized = normalizeTaskStatus(status);

  switch (normalized) {
    case "assigned":
    case "pending":
      return 5;
    case "in_progress":
      return 10;
    case "testing":
      return 75;
    case "review":
      return 90;
    case "completed":
      return 100;
    case "cancelled":
      return 0;
    case "delayed":
      return 25;
    default:
      return null;
  }
}; 

const isCompletedStatus = (status) => normalizeTaskStatus(status) === "completed";

const isTaskOverdue = (dueDate) => {
  if (!dueDate) {
    return false;
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return false;
  }

  return due < new Date();
};

const applyDelayedStatus = (taskData) => {
  if (!taskData || !taskData.dueDate || isCompletedStatus(taskData.status)) {
    return taskData;
  }

  const normalizedStatus = normalizeTaskStatus(taskData.status);
  if (isTaskOverdue(taskData.dueDate) && normalizedStatus !== "delayed") {
    taskData.status = "delayed";
  } else if (taskData.status) {
    taskData.status = normalizedStatus;
  }

  return taskData;
};

const applyProgressFromStatus = (taskData) => {
  if (!taskData || !taskData.status) {
    return taskData;
  }

  const normalizedStatus = normalizeTaskStatus(taskData.status);
  taskData.status = normalizedStatus;

  const autoProgress = getProgressForStatus(normalizedStatus);
  if (autoProgress !== null) {
    taskData.progress = autoProgress;
  }

  return taskData;
};

const ensureDelayedStatusForDocument = async (task) => {
  if (!task || !task.dueDate || isCompletedStatus(task.status) || normalizeTaskStatus(task.status) === "delayed") {
    return task;
  }

  if (isTaskOverdue(task.dueDate)) {
    task.status = "delayed";
    task.progress = getProgressForStatus(task.status) ?? task.progress;
    await task.save();
  }

  return task;
};

// ================= CREATE TASK =================
exports.createTask = async (req, res) => {
  try {
    console.log("========== CREATE TASK ==========");
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Body:", req.body);
    console.log("Files:", req.files);

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body is empty",
      }); 
    }

    const {
      projectId,
      taskTitle,
      taskDescription,
      assignedEmployee: inputEmployee,
      assignedTo,
      assignedIntern,
      assignedTeamLeadUser,
      assignedTeamLeadEmployee,
      assignedBy, 
      dueDate,
      estimatedHours,
      priority,
      status,
      progress,
    } = req.body;

    let assignedEmployee = inputEmployee || assignedTo || null;
    if (assignedEmployee) {
      try {
        const emp = await Employee.findById(assignedEmployee).select("userID userId");
        if (emp?.userID || emp?.userId) {
          assignedEmployee = emp.userID || emp.userId;
        }
      } catch (e) {}
    }

    // Required field validation
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project is required",
      });
    }

    if (!taskTitle) {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }

    if (!assignedEmployee && !assignedTeamLeadUser && !assignedTeamLeadEmployee) {
      return res.status(400).json({
        success: false,
        message: "Assigned Employee is required",
      });
    }

    if (!assignedBy) {
      return res.status(400).json({
        success: false,
        message: "Assigned By is required",
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message: "Due date is required",
      });
    }

    // Parse JSON fields sent from Flutter
    let taskDependencies = [];
    let subTasks = [];
    let checklist = [];
    let comments = [];

    try {
      if (req.body.taskDependencies) {
        taskDependencies = JSON.parse(req.body.taskDependencies);
      }

      if (req.body.subTasks) {
        subTasks = JSON.parse(req.body.subTasks);
      }

      if (req.body.checklist) {
        checklist = JSON.parse(req.body.checklist);
      }

      if (req.body.comments) {
        comments = JSON.parse(req.body.comments);
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON format",
      });
    }

    // Handle uploaded files & body attachments
    const attachments = [];

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        attachments.push({
          fileName: file.originalname,
          fileUrl: formatFileUrl(file.path || file.filename || "", req),
        });
      });
    }

    if (req.body.attachments) {
      try {
        const parsedAttachments =
          typeof req.body.attachments === "string"
            ? JSON.parse(req.body.attachments)
            : req.body.attachments;

        if (Array.isArray(parsedAttachments)) {
          parsedAttachments.forEach((att) => {
            if (typeof att === "string") {
              const fileName = att.split("/").pop() || att;
              attachments.push({
                fileName,
                fileUrl: formatFileUrl(att, req),
              });
            } else if (att && typeof att === "object") {
              const rawUrl = att.fileUrl || att.url || att.path || att.fileName || "";
              const fileName = att.fileName || rawUrl.split("/").pop() || "attachment";
              attachments.push({
                fileName,
                fileUrl: formatFileUrl(rawUrl, req),
              });
            }
          });
        }
      } catch (e) {
        console.warn("Could not parse req.body.attachments:", e);
      }
    }

const taskPayload = applyDelayedStatus(
  applyProgressFromStatus({
    projectId,
    taskTitle,
    taskDescription,
    assignedEmployee,
    assignedIntern: assignedIntern || null,
    assignedTeamLeadUser: assignedTeamLeadUser || null,
    assignedTeamLeadEmployee: assignedTeamLeadEmployee || null,
    assignedBy,
    dueDate,
    estimatedHours,
    priority,
    status,
    progress,
    taskDependencies,
    subTasks,
    checklist,
    comments,
    attachments,
  })
);

const createdTask = await TaskManagement.create(taskPayload);
const [resolvedTask] = await resolveTasksWithEmployees([createdTask], req);

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: resolvedTask,
    });
  } catch (error) {
    console.error("Create Task Error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ================= GET ALL TASKS =================
exports.getAllTasks =
  async (req, res) => {
    try {
      await TaskManagement.updateMany(
        {
          dueDate: { $lt: new Date() },
          status: { $nin: ["Completed", "Delayed", "completed", "delayed"] },
        },
        { status: "Delayed" }
      );

      const tasks = await TaskManagement.find();
      const resolvedTasks = await resolveTasksWithEmployees(tasks, req);

      res.status(200).json({
        success: true,
        count: resolvedTasks.length,
        data: resolvedTasks,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ================= GET SINGLE TASK =================
exports.getTaskById =
  async (req, res) => {
    try {
      let task =
        await TaskManagement
          .findById(
            req.params.id
          );

      if (!task) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Task not found",
          });
      }

      task = await ensureDelayedStatusForDocument(task);
      const [resolvedTask] = await resolveTasksWithEmployees([task], req);

      res.status(200).json({
        success: true,
        data: resolvedTask,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ================= UPDATE TASK =================
exports.updateTask =
  async (req, res) => {
    try {
      let updatePayload = { ...req.body };

      if (req.files && req.files.length > 0) {
        const newAttachments = req.files.map((file) => ({
          fileName: file.originalname,
          fileUrl: formatFileUrl(file.path || file.filename || "", req),
        }));

        if (req.body.attachments) {
          try {
            const parsed = typeof req.body.attachments === "string" ? JSON.parse(req.body.attachments) : req.body.attachments;
            if (Array.isArray(parsed)) {
              parsed.forEach((att) => {
                if (typeof att === "string") {
                  newAttachments.push({ fileName: att.split("/").pop() || att, fileUrl: formatFileUrl(att, req) });
                } else if (att && typeof att === "object") {
                  newAttachments.push({ fileName: att.fileName || "attachment", fileUrl: formatFileUrl(att.fileUrl || att.url || "", req) });
                }
              });
            }
          } catch (e) {}
        }
        updatePayload.attachments = newAttachments;
      } else if (req.body.attachments) {
        try {
          const parsed = typeof req.body.attachments === "string" ? JSON.parse(req.body.attachments) : req.body.attachments;
          if (Array.isArray(parsed)) {
            updatePayload.attachments = parsed.map((att) => {
              if (typeof att === "string") {
                return { fileName: att.split("/").pop() || att, fileUrl: formatFileUrl(att, req) };
              }
              return { fileName: att.fileName || "attachment", fileUrl: formatFileUrl(att.fileUrl || att.url || "", req) };
            });
          }
        } catch (e) {}
      }

      updatePayload = applyDelayedStatus(
        applyProgressFromStatus(updatePayload)
      );

      const task =
        await TaskManagement.findByIdAndUpdate(
          req.params.id,
          updatePayload,
          {
            new: true,
          }
        );

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Task not found",
        });
      }

      const ensuredTask = await ensureDelayedStatusForDocument(task);
      const [resolvedTask] = await resolveTasksWithEmployees([ensuredTask], req);

      res.status(200).json({
        success: true,
        message:
          "Task updated successfully",
        data: resolvedTask,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ================= UPDATE TASK STATUS =================
exports.createStatus = async (req, res) => {
  try {
    const { taskId, status } = req.body;

    if (!taskId || !status) {
      return res.status(400).json({
        success: false,
        message: "Task ID and Status are required",
      });
    }

    const task = await TaskManagement.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    task.status = normalizeTaskStatus(status);

    const autoProgress = getProgressForStatus(task.status);
    if (autoProgress !== null) {
      task.progress = autoProgress;
    }

    if (!Array.isArray(task.taskHistory)) task.taskHistory = [];
    task.taskHistory.push({
      action: `Status created: ${task.status}`,
    });

    await task.save();

    res.status(200).json({
      success: true,
      message: "Status added successfully",
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET STATUS =================
exports.getStatus = async (req, res) => {
  try {
    const task = await TaskManagement.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.status(200).json({
      success: true,
      status: task.status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
 

exports.updateTaskStatus =
  async (req, res) => {
    try {
      const {
        status,
      } = req.body;

      const task =
        await TaskManagement.findById(
          req.params.id
        );

      if (!task) {
        return res
          .status(404)
          .json({ 
            success: false,
            message:
              "Task not found",
          });
      }

      task.status = normalizeTaskStatus(status);

      if (!isCompletedStatus(task.status) && isTaskOverdue(task.dueDate)) {
        task.status = "delayed";
      }

      const autoProgress = getProgressForStatus(task.status);
      if (autoProgress !== null) {
        task.progress = autoProgress;
      }

      if (task.status === "completed") {
        task.completedAt = new Date();
      } else if (task.completedAt) {
        task.completedAt = undefined;
      }

      if (!Array.isArray(task.taskHistory)) task.taskHistory = [];
      task.taskHistory.push({
        action:
          `Status changed to ${task.status}`,
      });

      await task.save();

      res.status(200).json({
        success: true,
        message:
          "Task status updated",
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

  exports.deleteStatus = async (req, res) => {
  try {
    const task = await TaskManagement.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    task.status = "";

    task.taskHistory.push({
      action: "Status deleted",
    });

    await task.save();

    res.status(200).json({
      success: true,
      message: "Status deleted successfully",
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ================= ADD COMMENT =================
exports.addComment =
  async (req, res) => {
    try {
      const {
        comment,
        commentedBy,
      } = req.body;

      const task =
        await TaskManagement.findById(
          req.params.id
        );

      task.comments.push({
        comment,
        commentedBy,
      });

      await task.save();

      res.status(200).json({
        success: true,
        message:
          "Comment added",
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

  // ================= GET TASKS BY EMPLOYEE ID =================
exports.getTasksByEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const idString = String(employeeId);
    const userIdCandidates = [idString];

    try {
      const Employee = require("../models/Employee");
      const employeeDoc = await Employee.findById(employeeId).select("userID userId");
      if (employeeDoc) {
        if (employeeDoc.userID) userIdCandidates.push(String(employeeDoc.userID));
        if (employeeDoc.userId) userIdCandidates.push(String(employeeDoc.userId));
      }
    } catch (error) {
      // ignore lookup failures and fall back to direct query
    }

    const uniqueUserIds = [...new Set(userIdCandidates.filter(Boolean))];

    const taskQuery = {
      $or: [
        { assignedEmployee: employeeId },
        { assignedEmployee: { $in: uniqueUserIds } },
        { assignedIntern: { $in: uniqueUserIds } },
        { assignedTeamLeadEmployee: employeeId },
        { assignedTeamLeadUser: { $in: uniqueUserIds } },
      ],
    };

    await TaskManagement.updateMany(
      {
        ...taskQuery,
        dueDate: { $lt: new Date() },
        status: { $nin: ["Completed", "Delayed", "completed", "delayed"] },
      },
      { status: "Delayed" }
    );

    const tasks = await TaskManagement.find(taskQuery);

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No tasks found for this employee",
      });
    }

    const resolvedTasks = await resolveTasksWithEmployees(tasks, req);

    return res.status(200).json({
      success: true,
      count: resolvedTasks.length,
      data: resolvedTasks,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= DELETE TASK =================
exports.deleteTask =
  async (req, res) => {
    try {
      const task =
        await TaskManagement.findByIdAndDelete(
          req.params.id
        );

      if (!task) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Task not found",
          });
      }

      res.status(200).json({
        success: true,
        message:
          "Task deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };