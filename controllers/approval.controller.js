const ApprovalConfig = require('../models/ApprovalConfig');
const ApprovalTask = require('../models/ApprovalTask');
const { createNotification } = require('../services/notification.service');
const Role = require('../models/Role');
const User = require('../models/User');
const PurchaseOrder = require('../models/PurchaseOrder');
const Notification = require('../models/notification');
const { createOrUpdateConfigSchema, approveOrRejectSchema } = require('../validators/approval.validators');
const { recordAuditEvent } = require('../services/auditLog.service');
const mongoose = require('mongoose');

const fail = (message, statusCode = 400, errorCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
};

/**
 * POST /api/approval/config
 */
const createOrUpdateConfig = async (req, res, next) => {
  try {
    const parsed = createOrUpdateConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.errors[0].message,
        errors: parsed.error.errors
      });
    }

    const { companyId, module: configModule, thresholdAmount, levels, escalationEnabled, escalationAfterHours, escalationRoleId } = parsed.data;

    let config = await ApprovalConfig.findOne({ companyId, module: configModule });
    if (config) {
      config.thresholdAmount = thresholdAmount;
      config.levels = levels;
      config.escalationEnabled = escalationEnabled;
      config.escalationAfterHours = escalationAfterHours || null;
      config.escalationRoleId = escalationRoleId || null;
      config.updatedBy = req.user._id;
      await config.save();
    } else {
      config = await ApprovalConfig.create({
        companyId,
        module: configModule,
        thresholdAmount,
        levels,
        escalationEnabled,
        escalationAfterHours: escalationAfterHours || null,
        escalationRoleId: escalationRoleId || null,
        createdBy: req.user._id,
        updatedBy: req.user._id
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: config._id,
        companyId: config.companyId,
        module: config.module,
        thresholdAmount: config.thresholdAmount,
        levels: config.levels,
        escalationEnabled: config.escalationEnabled,
        escalationAfterHours: config.escalationAfterHours,
        escalationRoleId: config.escalationRoleId,
        isActive: config.isActive,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/approval/pending
 */
const getPendingApprovals = async (req, res, next) => {
  try {
    const { userId, companyId, module: queryModule } = req.query;
    if (!userId) {
      throw fail('userId query parameter is required', 400, 'USER_ID_REQUIRED');
    }
    if (!mongoose.isValidObjectId(userId)) {
      throw fail('Invalid userId format', 400, 'INVALID_USER_ID');
    }

    // Resolve user roles across their companies
    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({ success: true, data: { userId, items: [] } });
    }

    const userRoles = [];
    const companyAccess = user.companyAccess || [];
    for (const access of companyAccess) {
      if (access.isActive) {
        const roleDoc = await Role.findOne({
          companyId: access.companyId,
          name: new RegExp(`^${access.role}$`, 'i')
        });
        if (roleDoc) {
          userRoles.push({
            companyId: access.companyId.toString(),
            roleId: roleDoc._id.toString()
          });
        }
      }
    }

    // Find all pending tasks
    const query = { status: 'PENDING' };
    if (companyId) {
      if (!mongoose.isValidObjectId(companyId)) {
        throw fail('Invalid companyId format', 400, 'INVALID_COMPANY_ID');
      }
      query.companyId = companyId;
    }
    if (queryModule) {
      query.module = queryModule;
    }

    const tasks = await ApprovalTask.find(query).populate('approvalConfigId').sort({ createdAt: -1 });

    const filteredItems = tasks.filter(task => {
      // 1. Check direct assignment
      if (task.assignedToUserId && task.assignedToUserId.toString() === userId.toString()) {
        return true;
      }

      // 2. Check level-specific roleId or explicit userIds
      const config = task.approvalConfigId;
      if (!config) return false;

      const currentLvl = config.levels.find(l => l.level === task.currentLevel);
      if (!currentLvl) return false;

      // Check explicit userIds list
      if (currentLvl.userIds && currentLvl.userIds.some(uid => uid.toString() === userId.toString())) {
        return true;
      }

      // Check roleId match
      if (currentLvl.roleId) {
        const matchesRole = userRoles.some(ur => 
          ur.companyId === task.companyId.toString() && 
          ur.roleId === currentLvl.roleId.toString()
        );
        if (matchesRole) return true;
      }

      return false;
    });

    const items = filteredItems.map(task => ({
      id: task._id,
      companyId: task.companyId,
      module: task.module,
      entityId: task.entityId,
      entityType: task.entityType,
      currentLevel: task.currentLevel,
      status: task.status,
      createdAt: task.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: {
        userId,
        items
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/approval/:id/approve
 */
const approveTask = async (req, res, next) => {
  try {
    const taskId = req.params.id;
    if (!mongoose.isValidObjectId(taskId)) {
      throw fail('Approval task not found', 404, 'APPROVAL_TASK_NOT_FOUND');
    }

    const task = await ApprovalTask.findById(taskId);
    if (!task) {
      throw fail('Approval task not found', 404, 'APPROVAL_TASK_NOT_FOUND');
    }

    if (task.status !== 'PENDING') {
      throw fail('Approval task is not in PENDING status', 400, 'TASK_NOT_PENDING');
    }

    // Load related config
    const config = await ApprovalConfig.findById(task.approvalConfigId);
    if (!config) {
      throw fail('Associated approval configuration not found', 404, 'CONFIG_NOT_FOUND');
    }

    const currentLvl = config.levels.find(l => l.level === task.currentLevel);
    if (!currentLvl) {
      throw fail('Current level rules not found', 404, 'LEVEL_NOT_FOUND');
    }

    // Check authorization: User must be owner, or explicit user, or have matched role
    const company = await mongoose.model('Company').findById(task.companyId).select('createdBy');
    const isOwner = company && company.createdBy.toString() === req.user._id.toString();

    let isAuthorized = isOwner;
    if (!isAuthorized && task.assignedToUserId && task.assignedToUserId.toString() === req.user._id.toString()) {
      isAuthorized = true;
    }
    if (!isAuthorized && currentLvl.userIds && currentLvl.userIds.some(uid => uid.toString() === req.user._id.toString())) {
      isAuthorized = true;
    }
    if (!isAuthorized && currentLvl.roleId) {
      const activeAccess = (req.user.companyAccess || []).find(
        a => a.isActive && a.companyId.toString() === task.companyId.toString()
      );
      if (activeAccess) {
        const roleDoc = await Role.findOne({
          companyId: task.companyId,
          name: new RegExp(`^${activeAccess.role}$`, 'i')
        });
        if (roleDoc && roleDoc._id.toString() === currentLvl.roleId.toString()) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      throw fail('Access denied: You are not authorized to approve this task', 403, 'FORBIDDEN');
    }

    const parsedBody = approveOrRejectSchema.safeParse(req.body);
    const reason = parsedBody.success ? parsedBody.data.reason : null;

    // Append to history
    task.history.push({
      level: task.currentLevel,
      action: 'APPROVED',
      userId: req.user._id,
      reason
    });

    // Check next level
    const sortedLevels = [...config.levels].sort((a, b) => a.level - b.level);
    const nextLevel = sortedLevels.find(l => l.level > task.currentLevel);

    if (nextLevel) {
      task.currentLevel = nextLevel.level;
      task.assignedToUserId = nextLevel.userIds?.[0] || null;
      task.status = 'PENDING';
    } else {
      task.status = 'APPROVED';
      task.decisionByUserId = req.user._id;
      task.decisionAt = new Date();
      task.decisionReason = reason || null;
      task.assignedToUserId = null;

      // Final Approval - Update underlying transaction
      if (task.module === 'PURCHASE_ORDER') {
        const po = await PurchaseOrder.findById(task.entityId);
        if (po) {
          po.status = 'APPROVED';
          po.approvedBy = req.user._id;
          po.approvedAt = new Date();
          po.updatedBy = req.user._id;
          await po.save();

          if (po.createdBy) {
            createNotification({
              userId: po.createdBy,
              companyId: task.companyId,
              type: 'PO_APPROVED',
              title: 'Purchase Order Approved',
              message: `Your Purchase Order #${po.poNumber} has been approved.`,
              channel: 'PUSH',
              meta: { poId: po._id.toString(), poNumber: po.poNumber }
            }).catch(() => {});
          }
        }
      }
    }

    await task.save();

    // Audit Log
    await recordAuditEvent({
      companyId: task.companyId,
      userId: req.user._id,
      module: task.module,
      actionType: 'APPROVE',
      entityId: task.entityId,
      entityType: task.entityType,
      description: `Approval task ${task._id} approved at level ${task.history[task.history.length - 1].level} by ${req.user._id}`,
      metadata: { reason }
    }).catch(() => {});

    // Notification for next level
    if (task.status === 'PENDING') {
      const nextLvl = config.levels.find(l => l.level === task.currentLevel);
      const nextUsers = [];
      if (task.assignedToUserId) {
        nextUsers.push(task.assignedToUserId);
      } else if (nextLvl) {
        if (nextLvl.userIds && nextLvl.userIds.length > 0) nextUsers.push(...nextLvl.userIds);
        if (nextLvl.roleId) {
          const roleDoc = await Role.findById(nextLvl.roleId);
          if (roleDoc) {
            const users = await User.find({
              'companyAccess.companyId': task.companyId,
              'companyAccess.role': new RegExp(`^${roleDoc.name}$`, 'i'),
              'companyAccess.isActive': true
            });
            nextUsers.push(...users.map(u => u._id));
          }
        }
      }
      for (const uid of [...new Set(nextUsers.map(id => id.toString()))]) {
        await createNotification({
          userId: uid,
          companyId: task.companyId,
          type: 'APPROVAL_REQUIRED',
          title: 'Approval Required',
          message: `Approval task for ${task.entityType} requires your review (Level ${task.currentLevel}).`,
          channel: 'PUSH',
          meta: { taskId: task._id.toString(), entityId: task.entityId.toString(), entityType: task.entityType }
        }).catch(() => {});
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        id: task._id,
        status: task.status,
        currentLevel: task.currentLevel,
        decisionByUserId: task.decisionByUserId,
        decisionAt: task.decisionAt,
        decisionReason: task.decisionReason
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/approval/:id/reject
 */
const rejectTask = async (req, res, next) => {
  try {
    const taskId = req.params.id;
    if (!mongoose.isValidObjectId(taskId)) {
      throw fail('Approval task not found', 404, 'APPROVAL_TASK_NOT_FOUND');
    }

    const task = await ApprovalTask.findById(taskId);
    if (!task) {
      throw fail('Approval task not found', 404, 'APPROVAL_TASK_NOT_FOUND');
    }

    if (task.status !== 'PENDING') {
      throw fail('Approval task is not in PENDING status', 400, 'TASK_NOT_PENDING');
    }

    // Load config
    const config = await ApprovalConfig.findById(task.approvalConfigId);
    if (!config) {
      throw fail('Associated approval configuration not found', 404, 'CONFIG_NOT_FOUND');
    }

    const currentLvl = config.levels.find(l => l.level === task.currentLevel);
    if (!currentLvl) {
      throw fail('Current level rules not found', 404, 'LEVEL_NOT_FOUND');
    }

    // Authorization check
    const company = await mongoose.model('Company').findById(task.companyId).select('createdBy');
    const isOwner = company && company.createdBy.toString() === req.user._id.toString();

    let isAuthorized = isOwner;
    if (!isAuthorized && task.assignedToUserId && task.assignedToUserId.toString() === req.user._id.toString()) {
      isAuthorized = true;
    }
    if (!isAuthorized && currentLvl.userIds && currentLvl.userIds.some(uid => uid.toString() === req.user._id.toString())) {
      isAuthorized = true;
    }
    if (!isAuthorized && currentLvl.roleId) {
      const activeAccess = (req.user.companyAccess || []).find(
        a => a.isActive && a.companyId.toString() === task.companyId.toString()
      );
      if (activeAccess) {
        const roleDoc = await Role.findOne({
          companyId: task.companyId,
          name: new RegExp(`^${activeAccess.role}$`, 'i')
        });
        if (roleDoc && roleDoc._id.toString() === currentLvl.roleId.toString()) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      throw fail('Access denied: You are not authorized to reject this task', 403, 'FORBIDDEN');
    }

    const parsedBody = approveOrRejectSchema.safeParse(req.body);
    const reason = parsedBody.success && parsedBody.data.reason ? parsedBody.data.reason : 'No reason provided';

    // Append to history
    task.history.push({
      level: task.currentLevel,
      action: 'REJECTED',
      userId: req.user._id,
      reason
    });

    task.status = 'REJECTED';
    task.decisionByUserId = req.user._id;
    task.decisionAt = new Date();
    task.decisionReason = reason;
    task.assignedToUserId = null;

    // Update underlying PO status to CANCELLED
    if (task.module === 'PURCHASE_ORDER') {
      const po = await PurchaseOrder.findById(task.entityId);
      if (po) {
        po.status = 'CANCELLED';
        po.updatedBy = req.user._id;
        await po.save();

        if (po.createdBy) {
          createNotification({
            userId: po.createdBy,
            companyId: task.companyId,
            type: 'PO_REJECTED',
            title: 'Purchase Order Rejected',
            message: `Your Purchase Order #${po.poNumber} was rejected. Reason: ${reason}`,
            channel: 'PUSH',
            meta: { poId: po._id.toString(), poNumber: po.poNumber, reason }
          }).catch(() => {});
        }
      }
    }

    await task.save();

    // Audit Log
    await recordAuditEvent({
      companyId: task.companyId,
      userId: req.user._id,
      module: task.module,
      actionType: 'REJECT',
      entityId: task.entityId,
      entityType: task.entityType,
      description: `Approval task ${task._id} rejected by ${req.user._id}`,
      metadata: { reason }
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      data: {
        id: task._id,
        status: task.status,
        decisionByUserId: task.decisionByUserId,
        decisionAt: task.decisionAt,
        decisionReason: task.decisionReason
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/approval/:id/history
 */
const getApprovalHistory = async (req, res, next) => {
  try {
    const taskId = req.params.id;
    if (!mongoose.isValidObjectId(taskId)) {
      throw fail('Approval task not found', 404, 'APPROVAL_TASK_NOT_FOUND');
    }

    const task = await ApprovalTask.findById(taskId);
    if (!task) {
      throw fail('Approval task not found', 404, 'APPROVAL_TASK_NOT_FOUND');
    }

    return res.status(200).json({
      success: true,
      data: {
        id: task._id,
        companyId: task.companyId,
        module: task.module,
        entityId: task.entityId,
        entityType: task.entityType,
        status: task.status,
        currentLevel: task.currentLevel,
        history: task.history.map(h => ({
          level: h.level,
          action: h.action,
          userId: h.userId,
          reason: h.reason,
          timestamp: h.timestamp
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrUpdateConfig,
  getPendingApprovals,
  approveTask,
  rejectTask,
  getApprovalHistory
};
