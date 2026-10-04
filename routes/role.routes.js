const express = require('express');
const router = express.Router();

const ktRoleRoutes = require('./roleRoutes');
const finRoleController = require('../controllers/role.controller');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');

// 1. KT HRMS Role Endpoints (/create, /list, /get/:id, /update/:id, /delete/:id)
router.use('/', ktRoleRoutes);

// 2. Finance Role Endpoints (/seed-default, /, /:id/permissions, /:id)
router.post('/seed-default', authenticate, checkCompanyAccess, finRoleController.seedDefault);
router.post('/', authenticate, checkCompanyAccess, finRoleController.createRole);
router.get('/', authenticate, checkCompanyAccess, finRoleController.listRoles);
router.put('/:id/permissions', authenticate, checkCompanyAccess, finRoleController.updatePermissions);
router.delete('/:id', authenticate, checkCompanyAccess, finRoleController.deleteRole);

module.exports = router;
