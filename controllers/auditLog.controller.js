const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');

/**
 * Helper to serialize an audit log document for response envelopes
 */
const serializeAuditLog = (log) => {
  if (!log) return null;
  const item = typeof log.toObject === 'function' ? log.toObject() : log;
  return {
    id: item._id,
    _id: item._id,
    actorId: item.actorId || item.userId || null,
    actorName: item.actorName || 'System',
    actorRole: item.actorRole || 'system',
    userId: item.userId || item.actorId || null,
    timestamp: item.timestamp || item.createdAt,
    action: item.action || item.actionType || 'UNKNOWN',
    actionType: item.actionType || item.action || 'UNKNOWN',
    module: item.module || 'GENERAL',
    entityType: item.entityType || null,
    entityId: item.entityId || null,
    description: item.description,
    oldValues: item.oldValues || null,
    newValues: item.newValues || null,
    metadata: item.metadata || {},
    ipAddress: item.ipAddress || '',
    userAgent: item.userAgent || '',
    companyId: item.companyId || null,
    branchId: item.branchId || null,
    createdAt: item.createdAt || item.timestamp,
  };
};

/**
 * GET /api/audit-log or /api/audit-logs
 * Paginated, filterable read endpoint for Admin and HR.
 * Supports filtering by date range (startDate/endDate or from/to),
 * actor (actorId/actor/userId), action (action/actionType), and entity (entityType/entity/entityId).
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const {
      companyId,
      branchId,
      userId,
      actorId,
      actor,
      module,
      action,
      actionType,
      entityType,
      entity,
      entityId,
      from,
      to,
      startDate,
      endDate,
      page,
      limit,
    } = req.query;

    const filter = {};

    // 1. Company Scoping (preserve multi-tenancy if applicable)
    const targetCompanyId = companyId || (req.user?.role !== 'super admin' ? req.user?.companyId : null);
    if (targetCompanyId && mongoose.Types.ObjectId.isValid(targetCompanyId)) {
      filter.companyId = targetCompanyId;
    }

    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      filter.branchId = branchId;
    }

    // 2. Date Range Filter (supports startDate/endDate and from/to)
    const dateStart = startDate || from;
    const dateEnd = endDate || to;
    if (dateStart || dateEnd) {
      filter.$and = filter.$and || [];
      if (dateStart) {
        const startDt = new Date(dateStart);
        filter.$and.push({
          $or: [
            { timestamp: { $gte: startDt } },
            { createdAt: { $gte: startDt } },
          ],
        });
      }
      if (dateEnd) {
        const endDt = new Date(dateEnd);
        filter.$and.push({
          $or: [
            { timestamp: { $lte: endDt } },
            { createdAt: { $lte: endDt } },
          ],
        });
      }
    }

    // 3. Actor Filter (actorId, userId, actor name/role)
    const resolvedActorId = actorId || userId || (mongoose.Types.ObjectId.isValid(actor) ? actor : null);
    if (resolvedActorId) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { actorId: resolvedActorId },
          { userId: resolvedActorId },
        ],
      });
    } else if (actor && typeof actor === 'string') {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { actorName: { $regex: actor, $options: 'i' } },
          { actorRole: { $regex: actor, $options: 'i' } },
        ],
      });
    }

    // 4. Action Filter (action or actionType)
    const targetAction = action || actionType;
    if (targetAction && typeof targetAction === 'string') {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { action: { $regex: new RegExp(`^${targetAction}$`, 'i') } },
          { actionType: { $regex: new RegExp(`^${targetAction}$`, 'i') } },
        ],
      });
    }

    // 5. Entity Filter (entityType, entity, entityId)
    const targetEntityType = entityType || entity;
    if (targetEntityType && typeof targetEntityType === 'string') {
      filter.entityType = { $regex: new RegExp(`^${targetEntityType}$`, 'i') };
    }
    if (entityId) {
      filter.entityId = entityId;
    }

    // 6. Module Filter
    if (module && typeof module === 'string') {
      filter.module = { $regex: new RegExp(`^${module}$`, 'i') };
    }

    // Pagination calculations
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const skipNum = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1, createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      message: 'Audit logs retrieved successfully',
      data: {
        companyId: targetCompanyId || null,
        filters: {
          startDate: dateStart || null,
          endDate: dateEnd || null,
          actorId: resolvedActorId || null,
          action: targetAction || null,
          entityType: targetEntityType || null,
          entityId: entityId || null,
          module: module || null,
          branchId: branchId || null,
        },
        items: items.map(serializeAuditLog),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/audit-log/:id or /api/audit-logs/:id
 * Retrieve details of a single audit log
 */
const getAuditLogById = async (req, res, next) => {
  try {
    let log = req.auditLog;
    if (!log) {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid audit log ID format',
        });
      }
      log = await AuditLog.findById(id).lean();
    }

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Audit log record not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Audit log retrieved successfully',
      data: serializeAuditLog(log),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogById,
  serializeAuditLog,
};
