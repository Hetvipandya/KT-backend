/**
 * Module 14 — Reports Controller (read-only)
 *
 * Thin HTTP layer: validates query params, delegates to reports.service,
 * and serialises the response using the standard { success, data } envelope.
 *
 * Auth:  All routes require Bearer token (applied in reports.routes.js).
 * Write: This controller never modifies transactional data.
 */

const mongoose      = require('mongoose');
const reportsService = require('../services/reports.service');

// ─── Shared query validation ──────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isValidDate = (value) =>
  !value || (ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value)));

/**
 * Parse and light-validate the common query parameters shared by all report
 * endpoints.  Returns null and writes a 4xx response when validation fails.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @returns {{ companyId, branchId, financialYearId, from, to } | null}
 */
const parseFilters = (req, res) => {
  const { companyId, branchId, financialYearId, from, to } = req.query;

  if (!companyId) {
    res.status(400).json({
      success: false,
      message: 'companyId query parameter is required',
      errorCode: 'COMPANY_ID_REQUIRED'
    });
    return null;
  }

  if (!isValidDate(from) || !isValidDate(to)) {
    res.status(400).json({
      success: false,
      message: 'from and to must use YYYY-MM-DD format',
      errorCode: 'INVALID_DATE_RANGE'
    });
    return null;
  }

  if (from && to && new Date(from) > new Date(to)) {
    res.status(400).json({
      success: false,
      message: '`from` must not be after `to`',
      errorCode: 'INVALID_DATE_RANGE'
    });
    return null;
  }

  return {
    companyId,
    branchId:        branchId        || undefined,
    financialYearId: financialYearId || undefined,
    from: from || null,
    to:   to   || null
  };
};

/**
 * Map a service-thrown structured error to the correct HTTP status.
 * Falls through to next(error) for unexpected errors.
 */
const handleError = (error, res, next) => {
  const status = error.statusCode || 500;
  if (status < 500) {
    return res.status(status).json({
      success:   false,
      message:   error.message,
      errorCode: error.errorCode || 'REPORT_ERROR'
    });
  }
  return next(error);
};

// ─── Factory helpers ──────────────────────────────────────────────────────────

/**
 * Creates an Express handler that generates and returns a report.
 * @param {'trial-balance'|'profit-loss'|'balance-sheet'|'gst'} reportType
 */
const reportHandler = (reportType) => {
  const serviceFn = {
    'trial-balance': reportsService.getTrialBalance,
    'profit-loss':   reportsService.getProfitLoss,
    'balance-sheet': reportsService.getBalanceSheet,
    'gst':           reportsService.getGstReport
  }[reportType];

  return async (req, res, next) => {
    try {
      const filters = parseFilters(req, res);
      if (!filters) return;

      const data = await serviceFn(filters.companyId, filters.branchId, filters);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleError(error, res, next);
    }
  };
};

/**
 * Creates an Express handler for an export endpoint.
 * @param {'trial-balance'|'profit-loss'|'balance-sheet'|'gst'} reportType
 */
const exportHandler = (reportType) => async (req, res, next) => {
  try {
    const filters = parseFilters(req, res);
    if (!filters) return;

    const data = await reportsService.exportReport(
      reportType,
      filters.companyId,
      filters.branchId,
      filters
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(error, res, next);
  }
};

/**
 * Creates an Express handler for direct PDF streaming.
 * @param {'trial-balance'|'profit-loss'|'balance-sheet'|'gst'} reportType
 */
const pdfHandler = (reportType) => {
  const serviceFn = {
    'trial-balance': reportsService.getTrialBalance,
    'profit-loss':   reportsService.getProfitLoss,
    'balance-sheet': reportsService.getBalanceSheet,
    'gst':           reportsService.getGstReport
  }[reportType];

  const pdfGenerator = {
    'trial-balance': require('../services/reportPdf.service').generateTrialBalancePdf,
    'profit-loss':   require('../services/reportPdf.service').generateProfitLossPdf,
    'balance-sheet': require('../services/reportPdf.service').generateBalanceSheetPdf,
    'gst':           require('../services/reportPdf.service').generateGstReportPdf
  }[reportType];

  return async (req, res, next) => {
    try {
      const filters = parseFilters(req, res);
      if (!filters) return;

      const company = await mongoose.model('Company').findById(filters.companyId).lean();
      const payload = await serviceFn(filters.companyId, filters.branchId, filters);

      const pdfBuffer = await pdfGenerator(company, payload);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${reportType}-${filters.companyId}.pdf"`);
      return res.send(pdfBuffer);
    } catch (error) {
      return handleError(error, res, next);
    }
  };
};

// ─── Exported handlers ────────────────────────────────────────────────────────

module.exports = {
  // Report endpoints
  getTrialBalance:  reportHandler('trial-balance'),
  getProfitLoss:    reportHandler('profit-loss'),
  getBalanceSheet:  reportHandler('balance-sheet'),
  getGstReport:     reportHandler('gst'),

  // PDF direct streaming endpoints
  getTrialBalancePdf: pdfHandler('trial-balance'),
  getProfitLossPdf:   pdfHandler('profit-loss'),
  getBalanceSheetPdf: pdfHandler('balance-sheet'),
  getGstReportPdf:    pdfHandler('gst'),

  // Export endpoints
  exportTrialBalance:  exportHandler('trial-balance'),
  exportProfitLoss:    exportHandler('profit-loss'),
  exportBalanceSheet:  exportHandler('balance-sheet'),
  exportGstReport:     exportHandler('gst')
};
