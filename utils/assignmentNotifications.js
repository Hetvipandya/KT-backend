const Employee = require("../models/Employee");
const User = require("../models/User");
const { notify } = require("./sendNotification");

const rawId = (value) => {
  if (!value) return null;
  return String(value._id || value.id || value);
};

const resolveUserId = async ({ id, kind = "user" }) => {
  const value = rawId(id);
  if (!value) return null;

  if (kind !== "employee") {
    const user = await User.findById(value);
    if (user) return rawId(user._id);
    if (kind === "user") return null;
  }

  const employee = await Employee.findById(value);
  if (employee) {
    const linkedUserId = employee.userID || employee.userId;
    return linkedUserId ? rawId(linkedUserId) : null;
  }

  // Project/team employee arrays historically also contain User IDs.
  if (kind === "employee") {
    const user = await User.findById(value);
    return user ? rawId(user._id) : null;
  }
  return null;
};

const notifyNewAssignments = async ({
  before = [],
  after = [],
  action,
  entityType,
  recordId,
  recordName = "",
}) => {
  const previouslyAssigned = new Set();
  for (const recipient of before) {
    let userId = null;
    try { userId = await resolveUserId(recipient); } catch (error) {
      console.error("[Assignment Notification] Recipient lookup failed:", error.message);
    }
    if (userId) previouslyAssigned.add(userId);
  }

  const notified = new Set();
  for (const recipient of after) {
    let userId = null;
    try { userId = await resolveUserId(recipient); } catch (error) {
      console.error("[Assignment Notification] Recipient lookup failed:", error.message);
    }
    if (!userId || previouslyAssigned.has(userId) || notified.has(userId)) continue;
    notified.add(userId);
    await notify({
      userId,
      type: action,
      title: `${entityType} assignment`,
      message: recordName
        ? `You have been assigned to ${entityType.toLowerCase()} "${recordName}".`
        : `You have been assigned to a ${entityType.toLowerCase()}.`,
      meta: {
        action,
        entityType,
        recordId: rawId(recordId),
        ...(entityType === "Project" ? { projectId: rawId(recordId) } : {}),
        ...(entityType === "Task" ? { taskId: rawId(recordId) } : {}),
        ...(entityType === "Team" ? { teamId: rawId(recordId) } : {}),
        assigneeId: rawId(recipient.id),
        assigneeType: recipient.kind || "user",
      },
    });
  }
};

module.exports = { notifyNewAssignments, resolveUserId, rawId };

