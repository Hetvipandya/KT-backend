const test = require("node:test");
const assert = require("node:assert/strict");

const { buildProjectAssignmentTasks } = require("../controllers/projectController");

test("buildProjectAssignmentTasks creates tasks for assigned employees and interns", () => {
  const tasks = buildProjectAssignmentTasks({
    projectId: "64d4c6f7c7a8f2d9d5b6a123",
    projectName: "Website Redesign",
    employees: ["emp-1", "emp-2"],
    interns: ["intern-1"],
    assignedBy: "user-manager-1",
    employeeUserMap: {
      "emp-1": "user-emp-1",
      "emp-2": "user-emp-2",
    },
    internUserMap: {
      "intern-1": "user-intern-1",
    },
  });

  assert.equal(tasks.length, 3);
  assert.deepEqual(tasks[0], {
    projectId: "64d4c6f7c7a8f2d9d5b6a123",
    milestoneId: null,
    taskTitle: "Website Redesign - Employee 1",
    taskDescription: "Project assignment for Website Redesign.",
    assignedEmployee: "user-emp-1",
    assignedIntern: null,
    assignedBy: "user-manager-1",
    dueDate: null,
    estimatedHours: 0,
    priority: "medium",
    status: "Pending",
    progress: 0,
    taskDependencies: [],
    subTasks: [],
    checklist: [],
    comments: [],
    attachments: [],
  });

  const internTask = tasks.find((task) => task.assignedIntern === "user-intern-1");
  assert.ok(internTask);
  assert.equal(internTask.assignedEmployee, "user-manager-1");
  assert.equal(internTask.taskTitle, "Website Redesign - Intern 1");
});
