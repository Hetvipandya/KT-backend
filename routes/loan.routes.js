const express = require('express');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const validateRequest = require('../middleware/validateRequest');
const {
  createLoanSchema,
  createLoanRepaymentSchema,
  updateLoanSchema,
  loanQuerySchema,
  validateQuery
} = require('../validators/loan.validators');
const controller = require('../controllers/loan.controller');

const router = express.Router();

router.use(authenticate, checkCompanyAccess);
router.post('/', validateRequest(createLoanSchema), controller.create);
router.get('/', validateQuery(loanQuerySchema), controller.list);
router.get('/:id', controller.get);
router.put('/:id', validateRequest(updateLoanSchema), controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/repayments', validateRequest(createLoanRepaymentSchema), controller.repay);

module.exports = router;
