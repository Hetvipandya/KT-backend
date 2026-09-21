const ApprovalConfig = require('../models/ApprovalConfig');
const ApprovalTask = require('../models/ApprovalTask');
const Role = require('../models/Role');
const User = require('../models/User');
const { createNotification } = require('./notification.service');
const { recordAuditEvent } = require('./auditLog.service');

/**
 * Creates an approval task if transaction amount exceeds config threshold
 */
async function createApprovalTaskForTransaction({ companyId, module, entityId, entityType, amount }) {
  const config = await ApprovalConfig.findOne({ companyId, module, isActive: true });
  if (!config) return null; // No approval configured for this module

  if (amount <= config.thresholdAmount) return null; // Below threshold

  const level1 = config.levels.find(l => l.level === 1);
  if (!level1) return null;

  const assignedToUserId = level1.userIds?.[0] || null;

  const task = new ApprovalTask({
    companyId,
    module,
    entityId,
    entityType,
    approvalConfigId: config._id,
    status: 'PENDING',
    currentLevel: 1,
    assignedToUserId
  });

  await task.save();

  // 1. Record Audit Event
  await recordAuditEvent({
    companyId,
    module,
    actionType: 'APPROVAL_CREATED',
    entityId,
    entityType,
    description: `Approval task ${task._id} created for ${entityType} at level 1`,
    metadata: { thresholdAmount: config.thresholdAmount, amount }
  }).catch(() => {});

  // 2. Resolve users to notify
  const targetUserIds = [];
  if (assignedToUserId) {
    targetUserIds.push(assignedToUserId);
  } else {
    if (level1.userIds && level1.userIds.length > 0) {
      targetUserIds.push(...level1.userIds);
    }
    if (level1.roleId) {
      const roleDoc = await Role.findById(level1.roleId);
      if (roleDoc) {
        const users = await User.find({
          'companyAccess.companyId': companyId,
          'companyAccess.role': new RegExp(`^${roleDoc.name}$`, 'i'),
          'companyAccess.isActive': true
        });
        targetUserIds.push(...users.map(u => u._id));
      }
    }
  }

  // Send notifications via createNotification (persists record + fires FCM push)
  const uniqueUserIds = [...new Set(targetUserIds.map(id => id.toString()))];
  for (const uid of uniqueUserIds) {
    await createNotification({
      userId: uid,
      companyId,
      type: 'APPROVAL_REQUIRED',
      title: 'Approval Required',
      message: `Approval task for ${entityType} requires your review.`,
      channel: 'PUSH',
      meta: { taskId: task._id.toString(), entityId: entityId.toString(), entityType }
    }).catch(() => {});
  }

  return task;
}

module.exports = {
  createApprovalTaskForTransaction
};
