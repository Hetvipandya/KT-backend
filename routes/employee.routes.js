const express = require('express');
const authenticate = require('../middleware/authenticate');
const access = require('../middleware/companyAccess');
const validate = require('../middleware/validateRequest');
const {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
  validateQuery
} = require('../validators/employee.validators');
const controller = require('../controllers/employee.controller');

const router = express.Router();

router.post('/', authenticate, validate(createEmployeeSchema), access, controller.create);
router.get('/', authenticate, validateQuery(employeeQuerySchema), access, controller.list);
router.get('/:id', authenticate, access, controller.get);
router.put('/:id', authenticate, validate(updateEmployeeSchema), access, controller.update);

module.exports = router;
