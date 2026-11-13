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

router.use(authenticate, checkCompanyAccess);
router.post('/', validateRequest(createLendingSchema), controller.create);
router.get('/', validateQuery(lendingQuerySchema), controller.list);
router.get('/:id', controller.get);
router.post('/:id/repayments', validateRequest(createLendingRepaymentSchema), controller.repay);

module.exports = router;
