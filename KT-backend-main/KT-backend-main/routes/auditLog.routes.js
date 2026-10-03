const express = require('express');
const { getAuditLogs, getAuditLogById } = require('../controllers/auditLog.controller');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const { validateQuery, listAuditLogsSchema } = require('../validators/auditLog.validators');

const router = express.Router();

// Apply authentication globally to all audit log routes
router.use(authenticate);

// 1. Get filterable audit log trail
router.get(
  '/',
  validateQuery(listAuditLogsSchema),
  checkCompanyAccess,
  getAuditLogs
);

// 2. Get details of a single audit log
router.get(
  '/:id',
  checkCompanyAccess,
  getAuditLogById
);

module.exports = router;
