const TaskManagement =
  require("../models/TaskManagement");


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
      milestoneId,
      taskTitle,
      taskDescription,
      assignedEmployee,
      assignedIntern,
      assignedBy,
      dueDate,
      estimatedHours,
      priority,
      status,
      progress,
    } = req.body;

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

    if (!assignedEmployee) {
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

    // Handle uploaded files
    const attachments = [];

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        attachments.push({
          fileName: file.originalname,
          fileUrl: file.path || file.filename || "",
        });
      });
    }

const createdTask = await TaskManagement.create({
  projectId,
  milestoneId: milestoneId || null,
  taskTitle,
  taskDescription,
  assignedEmployee,
  assignedIntern: assignedIntern || null,
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
});

const task = await TaskManagement.findById(createdTask._id)
  .populate("projectId", "projectName")
  .populate("milestoneId", "title") // અથવા milestoneName
  .populate("assignedEmployee", "name")
  .populate("assignedIntern", "name")
  .populate("assignedBy", "name");

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
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
      const tasks =
        await TaskManagement
          .find()
          .populate(
            "projectId",
            "projectName"
          )
          .populate("milestoneId", "title")
          .populate(
            "assignedEmployee",
            "name email"
          )
          .populate(
            "assignedIntern",
            "name email"
          )
          .populate(
            "assignedBy",
            "name email"
          )
          .populate(
            "comments.commentedBy",
            "name email"
          );

      res.status(200).json({
        success: true,
        count:
          tasks.length,
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


// ================= GET SINGLE TASK =================
exports.getTaskById =
  async (req, res) => {
    try {
      const task =
        await TaskManagement
          .findById(
            req.params.id
          )
          .populate(
            "projectId"
          )
          .populate("milestoneId", "title")
          .populate(
            "assignedEmployee"
          )
          .populate(
            "assignedIntern"
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


// ================= UPDATE TASK =================
exports.updateTask =
  async (req, res) => {
    try {
      const task =
        await TaskManagement.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
          }
        );

      res.status(200).json({
        success: true,
        message:
          "Task updated successfully",
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

    task.status = status;

    task.taskHistory.push({
      action: `Status created: ${status}`,
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

      task.status =
        status;

      // Auto workflow progress
      switch (status) {
        case "Assigned":
          task.progress = 10;
          break;

        case "In Progress":
          task.progress = 50;
          break;

        case "Testing":
          task.progress = 75;
          break;
 
        case "Review":
          task.progress = 90;
          break;

        case "Completed":
          task.progress = 100;
          task.completedAt =
            new Date();
          break;

        default:
          break;
      }

      // Add history
      task.taskHistory.push({
        action:
          `Status changed to ${status}`,
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

    const tasks = await TaskManagement
      .find({ assignedEmployee: employeeId })
      .populate("projectId", "projectName")
      .populate("milestoneId", "milestoneName")
      .populate("assignedEmployee", "name email")
      .populate("assignedIntern", "name email")
      .populate("assignedBy", "name email")
      .populate("comments.commentedBy", "name email");

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No tasks found for this employee",
      });
    }

    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
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