const assert = require("assert");
const { toDateString } = require("../utils/leaveUtils");
const { shouldRequireApproval } = require("../controllers/userControllers");

console.log("Running User, Leave & Approval Workflow Tests...");

// 1. Test shouldRequireApproval helper
assert.strictEqual(shouldRequireApproval("employee"), true, "Employee role should require approval");
assert.strictEqual(shouldRequireApproval("intern"), true, "Intern role should require approval");
assert.strictEqual(shouldRequireApproval("team lead"), true, "Team lead role should require approval");
assert.strictEqual(shouldRequireApproval("admin"), false, "Admin role should not require approval");
assert.strictEqual(shouldRequireApproval("hr"), false, "HR role should not require approval");

// 2. Test toDateString helper
const today = new Date();
const todayFormatted = toDateString(today);
assert.match(todayFormatted, /^\d{4}-\d{2}-\d{2}$/, "Today date should match YYYY-MM-DD");

// Yesterday string calculation test
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = toDateString(yesterday);
assert.strictEqual(yesterdayStr < todayFormatted, true, "Yesterday should be strictly less than today");

// Tomorrow string calculation test
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = toDateString(tomorrow);
assert.strictEqual(tomorrowStr > todayFormatted, true, "Tomorrow should be strictly greater than today");

console.log("All User, Leave & Approval Workflow Tests Passed Successfully!");
