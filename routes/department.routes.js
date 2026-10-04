const express = require('express');
const router = express.Router();

const ktDepartmentRoutes = require('./departmentRoutes');
const finDepartmentController = require('../controllers/department.controller');
const authenticate = require('../middleware/authenticate');
const access = require('../middleware/companyAccess');
const validate = require('../middleware/validateRequest');
const {
  createDepartmentSchema,
  deptQuerySchema,
  validateQuery
} = require('../validators/department.validators');

// 1. KT HRMS Department Endpoints (/create, /list, /update)
router.use('/', ktDepartmentRoutes);

// 2. Finance Department Endpoints (/, /)
router.post('/', authenticate, validate(createDepartmentSchema), access, finDepartmentController.create);
router.get('/', authenticate, validateQuery(deptQuerySchema), access, finDepartmentController.list);

module.exports = router;
