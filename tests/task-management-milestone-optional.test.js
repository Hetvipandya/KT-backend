const mongoose = require("mongoose");
const TaskManagement = require("../models/TaskManagement");

describe("task management milestone handling", () => {
  it("allows creating a project-scoped task without a milestone", async () => {
    const task = new TaskManagement({
      projectId: new mongoose.Types.ObjectId(),
      taskTitle: "Landing page review",
      assignedEmployee: new mongoose.Types.ObjectId(),
      assignedBy: new mongoose.Types.ObjectId(),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await expect(task.validate()).resolves.toBeUndefined();
    expect(task.milestoneId).toBeNull();
  });
});
