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
    assignedTeamLead: "team-lead-user-1",
    employeeUserMap: {
      "emp-1": "user-emp-1",
      "emp-2": "user-emp-2",
    },
    internUserMap: {
      "intern-1": "user-intern-1",
    },
  });

  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].assignedTeamLeadUser, "team-lead-user-1");

  const internTask = tasks.find((task) => task.assignedIntern === "user-intern-1");
  assert.ok(internTask);
  assert.equal(internTask.assignedEmployee, null);
  assert.equal(internTask.assignedTeamLeadUser, "team-lead-user-1");
  assert.equal(internTask.taskTitle, "Website Redesign - Intern 1");
});
