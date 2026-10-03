const assert = require("assert");
const { toDateString } = require("../utils/leaveUtils");
const { shouldRequireApproval } = require("../controllers/userControllers");

describe("User, Leave & Approval Workflow Tests", () => {
  test("shouldRequireApproval helper correctly checks roles", () => {
    assert.strictEqual(shouldRequireApproval("employee"), true, "Employee role should require approval");
    assert.strictEqual(shouldRequireApproval("intern"), true, "Intern role should require approval");
    assert.strictEqual(shouldRequireApproval("team lead"), true, "Team lead role should require approval");
    assert.strictEqual(shouldRequireApproval("admin"), false, "Admin role should not require approval");
    assert.strictEqual(shouldRequireApproval("hr"), false, "HR role should not require approval");
  });

  test("toDateString helper correctly formats and orders dates", () => {
    const today = new Date();
    const todayFormatted = toDateString(today);
    assert.match(todayFormatted, /^\d{4}-\d{2}-\d{2}$/, "Today date should match YYYY-MM-DD");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toDateString(yesterday);
    assert.strictEqual(yesterdayStr < todayFormatted, true, "Yesterday should be strictly less than today");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toDateString(tomorrow);
    assert.strictEqual(tomorrowStr > todayFormatted, true, "Tomorrow should be strictly greater than today");
  });
});
