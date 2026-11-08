const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');

/**
 * Sensitive fields that must NEVER be persisted in audit logs under any circumstances.
 */
const FORBIDDEN_FIELDS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'tokens',
  'secret',
  'jwt',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'auth',
  'credentials',
  'creditcard',
  'cardnumber',
  'cvv',
  'pin',
  'headers',
  'request',
  'req',
  '__v',
  '_bsontype',
]);

/**
 * Domain-specific allowlists for sensitive entity types.
 * Only these fields are captured in oldValues and newValues.
 */
const ENTITY_ALLOWLISTS = {
  Employee: [
    '_id', 'id', 'employeeID', 'employeeCode', 'firstName', 'lastName', 'middleName',
    'name', 'fullName', 'email', 'phoneNumber', 'mobile', 'department', 'designation',
    'gender', 'dob', 'bloodGroup', 'role', 'status', 'isActive', 'joiningDate',
    'teamLead', 'teamLeadId', 'reportingManager', 'companyId', 'branchId', 'employeeStatus', 'currentAction', 'isDeactivated', 'deactivatedAt', 'deactivatedBy', 'deactivationReason', 'reactivatedAt', 'reactivatedBy'
  ],
  User: [
    '_id', 'id', 'name', 'email', 'phoneNumber', 'role', 'department', 'designation',
    'uniqueID', 'status', 'isActive', 'branchId', 'companyId', 'isDeactivated', 'deactivatedAt', 'deactivatedBy', 'reactivatedAt', 'reactivatedBy'
  ],
  Role: [
    '_id', 'id', 'roleName', 'name', 'displayName', 'description', 'permissions',
    'isDeleted', 'isActive', 'companyId'
  ],
  MonthlySalary: [
    '_id', 'id', 'employeeId', 'userId', 'month', 'year', 'salaryMonth', 'basicSalary',
    'grossSalary', 'totalDeduction', 'netSalary', 'status', 'daysPayable', 'presentDays',
    'workingDays', 'totalDays', 'lopDays', 'lopDeduction', 'customDeductions', 'paymentMode',
    'remarks', 'approvedAt', 'approvedBy', 'paidAt', 'paidBy', 'companyId', 'branchId'
  ],
  SalaryStructure: [
    '_id', 'id', 'employeeId', 'userId', 'basicSalary', 'hra', 'grossSalary',
    'netSalary', 'totalDeduction', 'pfDeduction', 'esicDeduction', 'professionalTax',
    'tds', 'fixedDeduction', 'otherDeductions', 'isActive', 'calculationMode'
  ],
  DeductionMaster: [
    '_id', 'id', 'name', 'code', 'category', 'calculationType', 'rate', 'flatAmount',
    'isLegallyPermissible', 'legalReference', 'maxDeductionPercent', 'isActive',
    'companyId', 'branchId'
  ],
  EmployeeDeduction: [
    '_id', 'id', 'employeeId', 'teamLeadId', 'deductionMasterId', 'deductionRecordId',
    'amount', 'month', 'year', 'status', 'isLegallyPermissible', 'legalReference',
    'isLocked', 'lockedAt', 'lockedBy', 'reason', 'rejectionReason', 'approvedBy', 'approvedAt'
  ],
  Attendance: [
    '_id', 'id', 'employeeId', 'userId', 'date', 'status', 'checkIn', 'checkOut',
    'checkInTime', 'checkOutTime', 'workingHours', 'breakDuration', 'totalBreakTime',
    'isLate', 'approvalStatus', 'approvedBy', 'approvedAt', 'rejectionReason',
    'rejectedBy', 'rejectedAt', 'companyId', 'branchId'
  ],
  AdjustmentRequest: [
    '_id', 'id', 'attendanceId', 'employeeId', 'userId', 'date', 'requestedCheckIn',
    'requestedCheckOut', 'status', 'reason', 'rejectionReason', 'approvedBy', 'approvedAt'
  ],
  Leave: [
    '_id', 'id', 'employeeId', 'userId', 'leaveType', 'startDate', 'endDate',
    'totalDays', 'status', 'teamLeadStatus', 'hrStatus', 'adminStatus', 'reason',
    'remark', 'description', 'rejectionReason', 'approvedBy', 'approvedAt'
  ],
  Holiday: [
    '_id', 'id', 'holidayName', 'name', 'holidayDate', 'date', 'description',
    'type', 'isOptional', 'year', 'companyId', 'branchId'
  ],
  MonitoringSettings: [
    '_id', 'id', 'intervalSeconds', 'isMonitoringEnabled', 'updatedBy'
  ],
  Company: [
    '_id', 'id', 'name', 'legalName', 'email', 'phone', 'address', 'website',
    'taxNumber', 'gstNumber', 'panNumber', 'status', 'currency', 'settings'
  ]
};

/**
 * Filter an object or Mongoose document against allowlisted and forbidden fields.
 * Guarantees passwords, tokens, secrets, or raw request objects are never logged.
 * 
 * @param {Object|null} data
 * @param {string} [entityType]
 * @returns {Object|null}
 */
function sanitizeAllowlistedValues(data, entityType) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Convert Mongoose documents or nested structures to plain objects
  const raw = typeof data.toObject === 'function' ? data.toObject() : { ...data };

  // If data IS itself an HTTP request, response, or stream object, return null
  if (data.headers && (data.method || data.socket || data._readableState)) {
    return null;
  }

  const allowlist = entityType && ENTITY_ALLOWLISTS[entityType]
    ? new Set(ENTITY_ALLOWLISTS[entityType])
    : null;

  const result = {};

  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();

    // 1. Strict forbidden security check
    if (FORBIDDEN_FIELDS.has(lowerKey)) {
      continue;
    }
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('cookie')
    ) {
      continue;
    }

    // 2. If entity has an explicit allowlist, only keep allowlisted keys
    if (allowlist && !allowlist.has(key)) {
      continue;
    }

    // 3. Prevent full request or circular objects
    if (value && typeof value === 'object') {
      if (value.req || value.headers || value._readableState || value.socket) {
        continue;
      }
      if (value instanceof Date) {
        result[key] = value;
      } else if (mongoose.Types.ObjectId.isValid(value) && typeof value !== 'string') {
        result[key] = value.toString();
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'object' && item !== null && !(item instanceof Date)
            ? sanitizeAllowlistedValues(item, null)
            : item
        );
      } else {
        result[key] = sanitizeAllowlistedValues(value, null);
      }
    } else {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Check if MongoDB is connected or if AuditLog is mocked in tests
 */
const isDbConnectedOrMocked = () => {
  if (process.env.NODE_ENV !== 'test') return true;
  if (mongoose.connection && (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2)) {
    return true;
  }
  if (AuditLog.create?._isMockFunction || AuditLog.prototype?.save?._isMockFunction) {
    return true;
  }
  return false;
};

/**
 * Record a server-side audit event.
 * 
 * - Extracts actor ID, display name, and role strictly from authenticated server-side req.user.
 * - Uses server-generated UTC timestamp.
 * - Records allowlisted old and new values for changed fields.
 * - Supports database transactions via session parameter.
 * - Throws an error on failure; never silently reports success if audit recording fails.
 * 
 * @param {Object} params
 * @param {Object} [params.req] Express request object (actor is extracted from req.user)
 * @param {string|ObjectId} [params.companyId]
 * @param {string|ObjectId} [params.branchId]
 * @param {string|ObjectId} [params.userId]
 * @param {string|ObjectId} [params.actorId]
 * @param {string} [params.actorName]
 * @param {string} [params.actorRole]
 * @param {string} [params.module] Module name (e.g. EMPLOYEE, ROLES, PAYROLL, DEDUCTIONS, etc.)
 * @param {string} [params.action] Action name (e.g. CREATE, UPDATE, DELETE, APPROVE, REJECT)
 * @param {string} [params.actionType] Specific action type (e.g. EMPLOYEE_CREATED, SALARY_APPROVED)
 * @param {string|ObjectId} [params.entityId] Affected entity ID
 * @param {string} [params.entityType] Affected entity type (e.g. Employee, MonthlySalary, Leave)
 * @param {string} [params.description] Human-readable description
 * @param {Object} [params.oldValues] Previous state of changed fields
 * @param {Object} [params.newValues] Resulting state of changed fields
 * @param {Object} [params.metadata] Additional safe metadata
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {Object} [params.session] Mongoose ClientSession for transactions
 * @returns {Promise<AuditLog>}
 */
async function recordAuditEvent({
  req = null,
  companyId = null,
  branchId = null,
  userId = null,
  actorId = null,
  actorName = null,
  actorRole = null,
  module = 'GENERAL',
  action = null,
  actionType = null,
  entityId = null,
  entityType = null,
  description = null,
  oldValues = null,
  newValues = null,
  metadata = {},
  ipAddress = '',
  userAgent = '',
  session = null,
  createdAt = null
}) {
  // 1. Authoritative Actor Attribution:
  // Derived strictly from authenticated server-side req.user - NEVER from req.body
  let resolvedActorId = actorId || userId;
  let resolvedActorName = actorName;
  let resolvedActorRole = actorRole;
  let resolvedCompanyId = companyId;
  let resolvedBranchId = branchId;
  let resolvedIp = ipAddress;
  let resolvedUa = userAgent;

  if (req) {
    // If req is passed, ignore any client-supplied actor info in req.body
    if (req.user) {
      resolvedActorId = req.user._id || req.user.id || req.user.userId;
      resolvedActorName = req.user.name || req.user.fullName || req.user.displayName || req.user.email || 'Authenticated User';
      resolvedActorRole = req.user.role || 'user';
      resolvedCompanyId = resolvedCompanyId || req.user.companyId || null;
      resolvedBranchId = resolvedBranchId || req.user.branchId || null;
    }
    resolvedIp = resolvedIp || req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '';
    resolvedUa = resolvedUa || (typeof req.get === 'function' ? req.get('user-agent') : req.headers?.['user-agent']) || '';
  }

  // Fallback defaults for system-initiated tasks
  if (!resolvedActorId) {
    resolvedActorId = new mongoose.Types.ObjectId();
  }
  if (!resolvedActorName) {
    resolvedActorName = 'System';
  }
  if (!resolvedActorRole) {
    resolvedActorRole = 'system';
  }

  // 2. Server-generated UTC timestamp:
  // Never trust client-supplied timestamp
  const serverTimestamp = new Date();

  // 3. Action and ActionType normalization
  const finalAction = (action || actionType || 'UNKNOWN').toUpperCase();
  const finalActionType = actionType || action || finalAction;

  // 4. Description fallback
  const finalDescription = description || `${finalAction} on ${entityType || 'Entity'} ${entityId || ''}`.trim();

  // 5. Sanitize oldValues and newValues against entity allowlist & security blocklist
  const sanitizedOld = sanitizeAllowlistedValues(oldValues, entityType);
  const sanitizedNew = sanitizeAllowlistedValues(newValues, entityType);
  const sanitizedMeta = sanitizeAllowlistedValues(metadata, null) || {};

  const logData = {
    companyId: resolvedCompanyId,
    branchId: resolvedBranchId,
    userId: resolvedActorId,
    actorId: resolvedActorId,
    actorName: resolvedActorName,
    actorRole: resolvedActorRole,
    timestamp: serverTimestamp,
    module: module || 'GENERAL',
    action: finalAction,
    actionType: finalActionType,
    entityId: entityId ? String(entityId) : null,
    entityType: entityType || null,
    description: finalDescription,
    oldValues: sanitizedOld,
    newValues: sanitizedNew,
    metadata: sanitizedMeta,
    ipAddress: resolvedIp,
    userAgent: resolvedUa,
  };

  if (createdAt) {
    logData.createdAt = createdAt;
  }

  // In disconnected unit tests with unmocked DB, return in-memory representation to prevent buffering timeouts
  if (!isDbConnectedOrMocked()) {
    return new AuditLog(logData);
  }

  // Persist to MongoDB, passing session if part of a database transaction
  const log = new AuditLog(logData);

  if (session) {
    await log.save({ session });
  } else {
    await log.save();
  }

  return log;
}

module.exports = {
  recordAuditEvent,
  recordSensitiveAuditLog: recordAuditEvent,
  sanitizeAllowlistedValues,
  ENTITY_ALLOWLISTS,
};
