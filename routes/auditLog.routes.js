const express = require('express');
const { getAuditLogs, getAuditLogById } = require('../controllers/auditLog.controller');
const { protect } = require('../middleware/authMiddleware');
const authenticate = require('../middleware/authenticate');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

/**
 * Universal authentication middleware accommodating both project auth styles
 */
const authMiddleware = async (req, res, next) => {
  if (req.user) return next();
  try {
    return await protect(req, res, () => {
      if (req.user) return next();
      return authenticate(req, res, next);
    });
  } catch (_) {
    return authenticate(req, res, next);
  }
};

// 1. Authenticate all requests
router.use(authMiddleware);

// 2. Enforce RBAC: Admin and HR only
router.use(authorizeRoles('admin', 'hr', 'super admin'));

// 3. Paginated, filterable read endpoint
router.get('/', getAuditLogs);

// 4. Single audit log detail read endpoint
router.get('/:id', getAuditLogById);

// 5. Immutability protection: explicitly block all update and delete routes
const blockMutation = (action) => (req, res) => {
  return res.status(405).json({
    success: false,
    message: `Audit records are immutable and cannot be ${action}.`,
  });
};

router.put('*', blockMutation('updated'));
router.patch('*', blockMutation('updated'));
router.delete('*', blockMutation('deleted'));

module.exports = router;
