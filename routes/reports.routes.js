const express = require('express');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const reportsController = require('../controllers/reports.controller');

const router = express.Router();

router.use(authenticate, checkCompanyAccess);

router.get('/trial-balance', reportsController.getTrialBalance);
router.get('/trial-balance/pdf', reportsController.getTrialBalancePdf);
router.get('/profit-loss', reportsController.getProfitLoss);
router.get('/profit-loss/pdf', reportsController.getProfitLossPdf);
router.get('/balance-sheet', reportsController.getBalanceSheet);
router.get('/balance-sheet/pdf', reportsController.getBalanceSheetPdf);
router.get('/gst', reportsController.getGstReport);
router.get('/gst/pdf', reportsController.getGstReportPdf);
router.get('/gst/export', reportsController.exportGstReport);
router.get('/trial-balance/export', reportsController.exportTrialBalance);
router.get('/profit-loss/export', reportsController.exportProfitLoss);
router.get('/balance-sheet/export', reportsController.exportBalanceSheet);

module.exports = router;
