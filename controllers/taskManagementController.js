const TaskManagement =
  require("../models/TaskManagement");


// ================= CREATE TASK =================
exports.createTask =
  async (req, res) => {
    try {
      const task =
        await TaskManagement.create(
          req.body
        );

      res.status(201).json({
        success: true,
        message:
          "Task created successfully",
        data: task,
      });
    } catch (error) {
      res.status(500).json({
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
            "projectId"
          )
          .populate(
            "taskId"
          )
          .populate(
            "assignedTo",
            "name email"
          )
          .populate(
            "assignedBy",
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
        message: error.message,
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
          );

      if (!task) {
        return res
          .status(404)
          .json({
            success:
              false,
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


// ================= UPDATE STATUS =================
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
            success:
              false,
            message:
              "Task not found",
          });
      }

      task.status =
        status;

      if (
        status ===
        "completed"
      ) {
        task.completedAt =
          new Date();
        task.progress =
          100;
      }

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
            success:
              false,
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