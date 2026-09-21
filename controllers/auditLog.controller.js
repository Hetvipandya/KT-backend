const AuditLog = require('../models/AuditLog');

/**
 * Helper to serialize an audit log document for response envelopes
 */
const serializeAuditLog = (log) => {
  const item = typeof log.toObject === 'function' ? log.toObject() : log;
  return {
    id: item._id,
    companyId: item.companyId,
    branchId: item.branchId || null,
    userId: item.userId || null,
    module: item.module,
    actionType: item.actionType,
    entityId: item.entityId || null,
    entityType: item.entityType || null,
    description: item.description,
    metadata: item.metadata || {},
    createdAt: item.createdAt,
    ipAddress: item.ipAddress || '',
    userAgent: item.userAgent || ''
  };
};

/**
 * GET /api/audit-log
 * Retrieve filterable and paginated list of audit logs for a company
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { companyId, branchId, userId, module, actionType, from, to, page, limit } = req.query;

    const filter = { companyId };

    if (branchId) filter.branchId = branchId;
    if (userId) filter.userId = userId;
    if (module) filter.module = module;
    if (actionType) filter.actionType = actionType;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const pageNum = Math.max(page || 1, 1);
    const limitNum = Math.min(Math.max(limit || 50, 1), 200);
    const skipNum = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        companyId,
        filters: {
          branchId: branchId || null,
          userId: userId || null,
          module: module || null,
          actionType: actionType || null,
          from: from || null,
          to: to || null
        },
        items: items.map(serializeAuditLog),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/audit-log/:id
 * Retrieve detail of a single audit log
 */
const getAuditLogById = async (req, res, next) => {
  try {
    // req.auditLog is loaded and cached by companyAccess middleware
    return res.status(200).json({
      success: true,
      data: serializeAuditLog(req.auditLog)
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogById
};
