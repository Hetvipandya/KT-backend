const AuditLog = require('../models/AuditLog');

/**
 * Record an audit event (internal write-only service).
 * @param {Object} params
 * @param {string} params.companyId
 * @param {string} [params.branchId]
 * @param {string} [params.userId]
 * @param {string} params.module
 * @param {string} params.actionType
 * @param {string} [params.entityId]
 * @param {string} [params.entityType]
 * @param {string} params.description
 * @param {Object} [params.metadata]
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @returns {Promise<AuditLog>}
 */
async function recordAuditEvent({
  companyId,
  branchId = null,
  userId = null,
  module,
  actionType,
  entityId = null,
  entityType = null,
  description,
  metadata = {},
  ipAddress = '',
  userAgent = '',
  createdAt = null
}) {
  if (!companyId || !module || !actionType || !description) {
    throw new Error('companyId, module, actionType, and description are required to record an audit event.');
  }

  const logData = {
    companyId,
    branchId,
    userId,
    module,
    actionType,
    entityId,
    entityType,
    description,
    metadata,
    ipAddress,
    userAgent
  };

  if (createdAt) {
    logData.createdAt = createdAt;
  }

  const log = new AuditLog(logData);

  await log.save();
  return log;
}

module.exports = { recordAuditEvent };
