const express = require('express');
const authenticate = require('../middleware/authenticate');
const access = require('../middleware/companyAccess');
const validate = require('../middleware/validateRequest');
const {
  createDepartmentSchema,
  deptQuerySchema,
  validateQuery
} = require('../validators/department.validators');
const controller = require('../controllers/department.controller');

const router = express.Router();

router.post('/', authenticate, validate(createDepartmentSchema), access, controller.create);
router.get('/', authenticate, validateQuery(deptQuerySchema), access, controller.list);

module.exports = router;
