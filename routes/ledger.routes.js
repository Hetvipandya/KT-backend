const express = require('express');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const { validateLedgerQuery } = require('../validators/ledger.validators');
const ledgerController = require('../controllers/ledger.controller');
const {
  READ_ROLES,
  requireFinanceCompanyAccess,
  requireFinanceRole
} = require('../middleware/financeAccess');

const router = express.Router();

router.use(
  authenticate,
  validateLedgerQuery,
  checkCompanyAccess,
  requireFinanceCompanyAccess,
  requireFinanceRole(READ_ROLES)
);
router.get('/:accountId/balance', ledgerController.getLedgerBalance);
router.get('/:accountId/pdf', ledgerController.getLedgerPdf);
router.get('/:accountId', ledgerController.getLedgerHistory);

module.exports = router;
