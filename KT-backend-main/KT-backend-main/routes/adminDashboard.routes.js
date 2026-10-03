const express = require('express');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const requireAdmin = require('../middleware/requireAdmin');
const { getAdminDashboard } = require('../controllers/adminDashboard.controller');

const router = express.Router();

// Apply authentication, company access, and admin role restrictions to all dashboard endpoints
router.use(authenticate, checkCompanyAccess, requireAdmin);

router.get('/', getAdminDashboard);

module.exports = router;
