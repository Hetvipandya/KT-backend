const mongoose = require('mongoose');
const Company = require('../models/Company');
const FinancialYear = require('../models/FinancialYear');
const caPanelService = require('../services/caPanel.service');
const gstService = require('../services/gst.service');

const formatDate = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/**
 * Common security check helper.
 * CA Panel is restricted to:
 * 1. Company Owner (creator)
 * 2. Super Admin, Admin, or CA roles (case-insensitive)
 */
const verifyAccess = (req, res) => {
  const isOwner = req.company.createdBy.toString() === req.user._id.toString();
  const roleName = req.callerRole?.name;
  const isAllowedRole = roleName && ['Super Admin', 'Admin', 'CA', 'Accountant'].some(
    (r) => r.toLowerCase() === roleName.toLowerCase()
  );

  if (!isOwner && !isAllowedRole) {
    res.status(403).json({
      success: false,
      message: 'Access denied: Dashboard is restricted to Super Admin, Admin, CA, or Accountant roles.',
      errorCode: 'CA_PANEL_RESTRICTED'
    });
    return false;
  }
  return true;
};

/**
 * GET /api/ca-panel/dashboard
 */
const getDashboard = async (req, res, next) => {
  try {
    if (!verifyAccess(req)) return;

    const companyId = req.query.companyId || req.company?._id?.toString();
    const branchId = req.query.branchId || req.branchId || null;
    const { financialYearId, from, to } = req.query;

    let targetFy = null;

    if (financialYearId) {
      if (!mongoose.Types.ObjectId.isValid(financialYearId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid financial year ID format',
          errorCode: 'INVALID_FINANCIAL_YEAR_ID'
        });
      }
      const fy = await FinancialYear.findById(financialYearId);
      if (!fy) {
        return res.status(404).json({
          success: false,
          message: 'Financial year not found',
          errorCode: 'FINANCIAL_YEAR_NOT_FOUND'
        });
      }
      if (fy.companyId.toString() !== companyId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Financial year does not belong to the specified company',
          errorCode: 'INVALID_FINANCIAL_YEAR_COMPANY'
        });
      }
      targetFy = fy;
    } else {
      // 1. Try header 'x-financial-year-id'
      const headerFyId = req.headers && req.headers['x-financial-year-id'];
      if (headerFyId && mongoose.Types.ObjectId.isValid(headerFyId)) {
        targetFy = await FinancialYear.findOne({ _id: headerFyId, companyId });
      }

      // 2. Try user's assigned financialYearId
      if (!targetFy && req.user && req.user.financialYearId && mongoose.Types.ObjectId.isValid(req.user.financialYearId)) {
        targetFy = await FinancialYear.findOne({ _id: req.user.financialYearId, companyId });
      }

      // 3. Auto-resolve active FY for branch / company
      if (!targetFy) {
        const now = new Date();
        if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
          targetFy = await FinancialYear.findOne({
            companyId,
            branchId,
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gte: now }
          });
          if (!targetFy) {
            targetFy = await FinancialYear.findOne({
              companyId,
              branchId,
              status: 'active'
            }).sort({ startDate: -1 });
          }
          if (!targetFy) {
            targetFy = await FinancialYear.findOne({
              companyId,
              branchId
            }).sort({ startDate: -1 });
          }
        }

        if (!targetFy) {
          targetFy = await FinancialYear.findOne({
            companyId,
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gte: now }
          });
        }

        if (!targetFy) {
          targetFy = await FinancialYear.findOne({
            companyId,
            status: 'active'
          }).sort({ startDate: -1 });
        }

        if (!targetFy) {
          targetFy = await FinancialYear.findOne({
            companyId
          }).sort({ startDate: -1 });
        }

        // 4. Try from recent JournalEntry
        if (!targetFy) {
          try {
            const journalFilter = { companyId };
            if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
              journalFilter.branchId = branchId;
            }
            const latestJournal = await mongoose.model('JournalEntry').findOne(journalFilter).sort({ entryDate: -1, createdAt: -1 });
            if (latestJournal && latestJournal.financialYearId) {
              targetFy = await FinancialYear.findOne({ _id: latestJournal.financialYearId, companyId });
            }
          } catch (ignore) {
            // Model might not be loaded yet
          }
        }
      }
    }

    let fyInfo = null;
    if (targetFy) {
      fyInfo = {
        id: targetFy._id.toString(),
        label: targetFy.yearLabel,
        startDate: targetFy.startDate,
        endDate: targetFy.endDate,
        period: {
          from: formatDate(from) || formatDate(targetFy.startDate),
          to: formatDate(to) || formatDate(targetFy.endDate)
        }
      };
    }

    const effectiveFrom = formatDate(from) || (targetFy ? formatDate(targetFy.startDate) : null);
    const effectiveTo = formatDate(to) || (targetFy ? formatDate(targetFy.endDate) : null);

    const snapshotOptions = {
      from: effectiveFrom,
      to: effectiveTo,
      financialYear: targetFy ? {
        id: targetFy._id.toString(),
        label: targetFy.yearLabel,
        startDate: targetFy.startDate,
        endDate: targetFy.endDate
      } : null
    };

    const financialSnapshot = await caPanelService.getFinancialSnapshot(
      companyId,
      financialYearId,
      branchId,
      snapshotOptions
    );
    
    // Call gst returns summary if service exists
    let gstSummary = { period: null, netPayable: 0 };
    if (gstService && typeof gstService.getGstReturnsSummary === 'function') {
      const summary = await gstService.getGstReturnsSummary(companyId, {
        from: effectiveFrom,
        to: effectiveTo
      });
      gstSummary = {
        period: summary.period || null,
        netPayable: summary.netPayable || 0
      };
    }

    const auditFlags = await caPanelService.getRecentAuditFlags(companyId);

    return res.status(200).json({
      success: true,
      data: {
        company: {
          id: req.company._id,
          name: req.company.name
        },
        financialYear: fyInfo,
        financialSnapshot,
        gstSummary,
        auditFlags
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ca-panel/audit-report
 */
const getAuditReport = async (req, res, next) => {
  try {
    if (!verifyAccess(req)) return;

    const companyId = req.query.companyId;
    const { from, to } = req.query;

    const report = await caPanelService.getConsolidatedAuditReport(companyId, { from, to });

    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ca-panel/income-tax-summary
 */
const getIncomeTaxSummary = async (req, res, next) => {
  try {
    if (!verifyAccess(req)) return;

    const companyId = req.query.companyId;
    const { financialYearId } = req.query;

    if (!financialYearId) {
      return res.status(400).json({
        success: false,
        message: 'financialYearId parameter is required',
        errorCode: 'FINANCIAL_YEAR_ID_REQUIRED'
      });
    }

    const fy = await FinancialYear.findById(financialYearId);
    if (!fy) {
      return res.status(404).json({
        success: false,
        message: 'Financial year not found',
        errorCode: 'FINANCIAL_YEAR_NOT_FOUND'
      });
    }
    if (fy.companyId.toString() !== companyId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Financial year does not belong to the specified company',
        errorCode: 'INVALID_FINANCIAL_YEAR_COMPANY'
      });
    }

    const summary = await caPanelService.computeIncomeTaxSummary(companyId, financialYearId);

    return res.status(200).json({
      success: true,
      data: {
        financialYear: {
          id: fy._id,
          label: fy.yearLabel
        },
        ...summary
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getAuditReport,
  getIncomeTaxSummary
};
