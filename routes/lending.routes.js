const express = require('express');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const validateRequest = require('../middleware/validateRequest');
const {
  createLendingSchema,
  createLendingRepaymentSchema,
  lendingQuerySchema,
  validateQuery,
} = require('../validators/lending.validators');
const controller = require('../controllers/lending.controller');

const router = express.Router();

router.use(authenticate);
router.post('/', checkCompanyAccess, validateRequest(createLendingSchema), controller.create);
router.get('/', checkCompanyAccess, validateQuery(lendingQuerySchema), controller.list);
router.get('/:id', checkCompanyAccess, controller.get);
router.post('/:id/repayments', checkCompanyAccess, validateRequest(createLendingRepaymentSchema), controller.repay);

module.exports = router;
